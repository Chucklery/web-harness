import { randomUUID } from 'node:crypto'
import {
  decodeFrame,
  encodeFrame,
  PROTOCOL_VERSION,
  type ToolRequest,
  type ToolResult,
  type WireFrame,
} from '@web-harness/protocol'
import WebSocket, { type RawData } from 'ws'
import { loadConfig } from './config.js'
import { LocalToolRuntime } from './local-tools.js'

const config = loadConfig()
const runtime = new LocalToolRuntime(config.projectRoot)
const runnerId = process.env.WEB_HARNESS_RUNNER_ID?.trim() || randomUUID()
const serverUrl =
  process.env.WEB_HARNESS_SERVER_URL?.trim() || `ws://${config.host}:${config.port}/ws/runner`

let retryMs = 100

function connect(): void {
  const socket = new WebSocket(serverUrl, {
    perMessageDeflate: false,
    handshakeTimeout: 5_000,
    headers: { Authorization: `Bearer ${config.token}` },
  })

  socket.binaryType = 'arraybuffer'

  socket.once('upgrade', (response) => {
    response.socket.setNoDelay(true)
    response.socket.setKeepAlive(true, 15_000)
  })

  socket.on('open', () => {
    retryMs = 100
    const hello: WireFrame = {
      type: 'runner.hello',
      protocolVersion: PROTOCOL_VERSION,
      runnerId,
      projectRoot: config.projectRoot,
    }
    socket.send(encodeFrame(hello), { binary: true })
  })

  socket.on('message', async (raw, isBinary) => {
    if (!isBinary) return
    try {
      const frame = decodeFrame(toBytes(raw))
      if (frame.type === 'tool.request') await handleTool(socket, frame)
      if (frame.type === 'ping')
        socket.send(encodeFrame({ type: 'pong', at: frame.at }), { binary: true })
    } catch {
      socket.close(1002, 'invalid protocol frame')
    }
  })

  socket.on('close', reconnect)
  socket.on('error', () => socket.terminate())
}

async function handleTool(socket: WebSocket, request: ToolRequest): Promise<void> {
  const started = performance.now()
  let response: ToolResult
  try {
    const result = await runtime.execute(request.tool, request.input)
    response = {
      type: 'tool.result',
      id: request.id,
      ok: true,
      result,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
    }
  } catch (error) {
    response = {
      type: 'tool.result',
      id: request.id,
      ok: false,
      error: {
        code: 'TOOL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      },
      durationMs: Math.round((performance.now() - started) * 100) / 100,
    }
  }
  socket.send(encodeFrame(response), { binary: true })
}

function reconnect(): void {
  const jitter = Math.floor(Math.random() * Math.min(retryMs * 0.2, 250))
  const delay = retryMs + jitter
  setTimeout(connect, delay).unref()
  retryMs = Math.min(retryMs * 2, 5_000)
}

function toBytes(raw: RawData): Uint8Array {
  if (Buffer.isBuffer(raw)) return new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)
  if (Array.isArray(raw)) {
    const joined = Buffer.concat(raw)
    return new Uint8Array(joined.buffer, joined.byteOffset, joined.byteLength)
  }
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw)
  throw new TypeError('Unsupported WebSocket payload')
}

connect()
