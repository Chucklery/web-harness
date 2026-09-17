import { randomUUID } from 'node:crypto'
import { decodeFrame, encodeFrame, type ToolName, type ToolResult, type WireFrame } from '@web-harness/protocol'
import WebSocket from 'ws'

interface PendingRequest {
  resolve(value: unknown): void
  reject(error: Error): void
  timer: NodeJS.Timeout
}

export class RemoteRunnerBridge {
  private socket: WebSocket | undefined
  private readonly pending = new Map<string, PendingRequest>()
  private runnerId = ''
  private connectedAt = 0
  private lastSeenAt = 0

  attach(socket: WebSocket, runnerId: string): void {
    this.detach(new Error('Runner replaced by a newer connection'))
    this.socket = socket
    this.runnerId = runnerId
    this.connectedAt = Date.now()
    this.lastSeenAt = Date.now()
  }

  detach(reason = new Error('Runner disconnected')): void {
    this.socket = undefined
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(reason)
    }
    this.pending.clear()
  }

  touch(): void {
    this.lastSeenAt = Date.now()
  }

  get status() {
    if (!this.socket) return undefined
    return { id: this.runnerId, connectedAt: this.connectedAt, lastSeenAt: this.lastSeenAt }
  }

  async execute(tool: ToolName, input: Record<string, unknown>): Promise<unknown> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('No remote runner is connected')
    }

    const id = randomUUID()
    const frame: WireFrame = { type: 'tool.request', id, tool, input }

    const promise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`Runner request timed out: ${tool}`))
      }, 30_000)
      timer.unref()
      this.pending.set(id, { resolve, reject, timer })
    })

    this.socket.send(encodeFrame(frame), { binary: true })
    return promise
  }

  onFrame(data: ArrayBuffer | Uint8Array): WireFrame {
    const frame = decodeFrame(data)
    this.touch()
    if (frame.type === 'tool.result') this.resolve(frame)
    return frame
  }

  private resolve(frame: ToolResult): void {
    const pending = this.pending.get(frame.id)
    if (!pending) return
    clearTimeout(pending.timer)
    this.pending.delete(frame.id)
    if (frame.ok) pending.resolve(frame.result)
    else pending.reject(new Error(frame.error?.message ?? 'Unknown runner error'))
  }
}
