import { randomUUID } from 'node:crypto'
import {
  decodeFrame,
  encodeFrame,
  type ToolName,
  type ToolResult,
  type WireFrame,
} from '@web-harness/protocol'
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
  private projectRoot = ''
  private connectedAt = 0
  private lastSeenAt = 0

  attach(socket: WebSocket, runnerId: string, projectRoot: string): void {
    const previous = this.socket
    this.detach(new Error('Runner replaced by a newer connection'))
    if (previous && previous !== socket) previous.terminate()
    this.socket = socket
    this.runnerId = runnerId
    this.projectRoot = projectRoot
    this.connectedAt = Date.now()
    this.lastSeenAt = Date.now()
  }

  detach(reason?: Error): boolean
  detach(socket: WebSocket, reason?: Error): boolean
  detach(socketOrReason?: WebSocket | Error, maybeReason?: Error): boolean {
    const socket = socketOrReason instanceof Error ? undefined : socketOrReason
    const reason =
      socketOrReason instanceof Error
        ? socketOrReason
        : (maybeReason ?? new Error('Runner disconnected'))
    if (socket && socket !== this.socket) return false

    this.socket = undefined
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer)
      pending.reject(reason)
    }
    this.pending.clear()
    return true
  }

  touch(socket?: WebSocket): boolean {
    if (socket && socket !== this.socket) return false
    if (!this.socket) return false
    this.lastSeenAt = Date.now()
    return true
  }

  get status() {
    if (!this.socket) return undefined
    return {
      id: this.runnerId,
      projectRoot: this.projectRoot,
      connectedAt: this.connectedAt,
      lastSeenAt: this.lastSeenAt,
    }
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

    if (this.socket.bufferedAmount > 1024 * 1024) {
      const pending = this.pending.get(id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pending.delete(id)
      }
      throw new Error('Remote runner transport is backpressured')
    }

    try {
      this.socket.send(encodeFrame(frame), { binary: true }, (error) => {
        if (!error) return
        const pending = this.pending.get(id)
        if (!pending) return
        clearTimeout(pending.timer)
        this.pending.delete(id)
        pending.reject(error)
      })
    } catch (error) {
      const pending = this.pending.get(id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pending.delete(id)
        pending.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }
    return promise
  }

  onFrame(socket: WebSocket, data: ArrayBuffer | Uint8Array): WireFrame {
    if (socket !== this.socket) throw new Error('Frame came from a stale runner connection')
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
