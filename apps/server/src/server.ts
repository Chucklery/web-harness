import { createReadStream } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PROTOCOL_VERSION,
  decodeFrame,
  encodeFrame,
  type RuntimeStatus,
  type ToolName,
  type UiEvent,
  type WireFrame,
} from '@web-harness/protocol'
import { WebSocketServer, type WebSocket } from 'ws'
import { isAuthorized } from './auth.js'
import type { RuntimeConfig } from './config.js'
import { LocalToolRuntime } from './local-tools.js'
import { RemoteRunnerBridge } from './remote-runner.js'

const VERSION = '0.1.0'
const startedAt = Date.now()

export class HarnessServer {
  private readonly localRuntime: LocalToolRuntime
  private readonly remoteBridge = new RemoteRunnerBridge()
  private readonly uiSockets = new Set<WebSocket>()
  private readonly server = createServer((request, response) => {
    void this.handleHttp(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : String(error)
      if (!response.headersSent) this.json(response, 400, { error: message })
      else response.destroy(error instanceof Error ? error : new Error(message))
    })
  })
  private readonly runnerWss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 4 * 1024 * 1024 })
  private readonly uiWss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 256 * 1024 })

  constructor(private readonly config: RuntimeConfig) {
    this.localRuntime = new LocalToolRuntime(config.projectRoot)
    this.configureUpgrade()
    this.configureRunnerWebSocket()
    this.configureUiWebSocket()
  }

  async listen(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.config.port, this.config.host, () => resolve())
    })
  }

  private configureUpgrade(): void {
    this.server.on('upgrade', (request, socket, head) => {
      socket.setNoDelay(true)
      socket.setKeepAlive(true, 15_000)

      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
      if (url.pathname === '/ws/ui') {
        this.uiWss.handleUpgrade(request, socket, head, (ws) => this.uiWss.emit('connection', ws, request))
        return
      }

      if (url.pathname === '/ws/runner' && isAuthorized(request, this.config.token)) {
        this.runnerWss.handleUpgrade(request, socket, head, (ws) => this.runnerWss.emit('connection', ws, request))
        return
      }

      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
      socket.destroy()
    })
  }

  private configureRunnerWebSocket(): void {
    this.runnerWss.on('connection', (socket) => {
      let registered = false
      socket.binaryType = 'arraybuffer'

      socket.on('message', (raw, isBinary) => {
        if (!isBinary) return socket.close(1003, 'binary MessagePack frames required')
        const bytes = raw instanceof Buffer ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength) : new Uint8Array(raw as ArrayBuffer)
        const frame = decodeFrame(bytes)

        if (!registered) {
          if (frame.type !== 'runner.hello' || frame.protocolVersion !== PROTOCOL_VERSION) {
            return socket.close(1002, 'protocol mismatch')
          }
          registered = true
          this.remoteBridge.attach(socket, frame.runnerId)
          const welcome: WireFrame = { type: 'runner.welcome', protocolVersion: PROTOCOL_VERSION, serverTime: Date.now() }
          socket.send(encodeFrame(welcome), { binary: true })
          this.broadcast({ type: 'ui.event', event: 'connected', at: Date.now(), detail: { runnerId: frame.runnerId } })
          return
        }

        const next = this.remoteBridge.onFrame(bytes)
        if (next.type === 'ping') socket.send(encodeFrame({ type: 'pong', at: next.at }), { binary: true })
      })

      socket.on('close', () => {
        if (registered) {
          this.remoteBridge.detach()
          this.broadcast({ type: 'ui.event', event: 'disconnected', at: Date.now() })
        }
      })
    })
  }

  private configureUiWebSocket(): void {
    this.uiWss.on('connection', (socket) => {
      this.uiSockets.add(socket)
      socket.send(JSON.stringify({ type: 'status', payload: this.status() }))
      socket.on('close', () => this.uiSockets.delete(socket))
    })
  }

  private broadcast(event: UiEvent): void {
    const payload = JSON.stringify(event)
    for (const socket of this.uiSockets) {
      if (socket.readyState === WebSocket.OPEN) socket.send(payload)
    }
  }

  private status(): RuntimeStatus {
    return {
      version: VERSION,
      protocolVersion: PROTOCOL_VERSION,
      mode: this.config.mode,
      connected: this.config.mode === 'local' || Boolean(this.remoteBridge.status),
      projectRoot: this.config.projectRoot,
      startedAt,
      ...(this.remoteBridge.status ? { runner: this.remoteBridge.status } : {}),
    }
  }

  private async handleHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Cache-Control', 'no-store')

    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)

    if (request.method === 'GET' && url.pathname === '/api/status') {
      return this.json(response, 200, this.status())
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/tools/')) {
      if (!isAuthorized(request, this.config.token)) return this.json(response, 401, { error: 'unauthorized' })
      return this.handleToolRequest(request, response, decodeURIComponent(url.pathname.slice('/api/tools/'.length)))
    }

    if (request.method === 'GET') {
      const served = await this.tryServeWebAsset(url.pathname, response)
      if (served) return
    }

    this.json(response, 404, { error: 'not_found' })
  }

  private async handleToolRequest(request: IncomingMessage, response: ServerResponse, rawTool: string): Promise<void> {
    const allowed: ToolName[] = ['project.info', 'fs.list', 'fs.read', 'fs.write', 'git.status', 'git.diff', 'process.run']
    if (!allowed.includes(rawTool as ToolName)) return this.json(response, 404, { error: 'unknown_tool' })

    const tool = rawTool as ToolName
    const started = performance.now()
    this.broadcast({ type: 'ui.event', event: 'tool.start', at: Date.now(), detail: { tool } })

    try {
      const input = await this.readJsonBody(request)
      const result = this.config.mode === 'local' ? await this.localRuntime.execute(tool, input) : await this.remoteBridge.execute(tool, input)
      const durationMs = Math.round((performance.now() - started) * 100) / 100
      this.broadcast({ type: 'ui.event', event: 'tool.finish', at: Date.now(), detail: { tool, durationMs, ok: true } })
      this.json(response, 200, { ok: true, result, durationMs })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const durationMs = Math.round((performance.now() - started) * 100) / 100
      this.broadcast({ type: 'ui.event', event: 'tool.finish', at: Date.now(), detail: { tool, durationMs, ok: false } })
      this.json(response, 400, { ok: false, error: message, durationMs })
    }
  }

  private async readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = []
    let bytes = 0
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk)
      bytes += buffer.byteLength
      if (bytes > 1_000_000) throw new Error('Request body exceeds 1 MiB')
      chunks.push(buffer)
    }
    if (chunks.length === 0) return {}
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('JSON body must be an object')
    return parsed as Record<string, unknown>
  }

  private async tryServeWebAsset(requestPath: string, response: ServerResponse): Promise<boolean> {
    const currentDir = path.dirname(fileURLToPath(import.meta.url))
    const candidates = [
      path.resolve(currentDir, '../../web/dist'),
      path.resolve(currentDir, '../../../web/dist'),
    ]
    const webRoot = candidates.find((candidate) => {
      try {
        return path.isAbsolute(candidate)
      } catch {
        return false
      }
    })
    if (!webRoot) return false

    const safePath = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '')
    let file = path.resolve(webRoot, safePath)
    if (!file.startsWith(webRoot)) return false

    try {
      const fileStat = await stat(file)
      if (fileStat.isDirectory()) file = path.join(file, 'index.html')
      await access(file)
    } catch {
      file = path.join(webRoot, 'index.html')
      try {
        await access(file)
      } catch {
        return false
      }
    }

    const ext = path.extname(file)
    const types: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.json': 'application/json; charset=utf-8',
    }
    response.statusCode = 200
    response.setHeader('Content-Type', types[ext] ?? 'application/octet-stream')
    response.setHeader('Cache-Control', ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable')
    createReadStream(file).pipe(response)
    return true
  }

  private json(response: ServerResponse, status: number, body: unknown): void {
    response.statusCode = status
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.end(JSON.stringify(body))
  }
}
