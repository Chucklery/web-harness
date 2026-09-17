import { decode, encode } from '@msgpack/msgpack'

export const PROTOCOL_VERSION = 1 as const

export type ConnectionMode = 'local' | 'remote'

export interface RuntimeStatus {
  version: string
  protocolVersion: number
  mode: ConnectionMode
  connected: boolean
  projectRoot: string
  startedAt: number
  runner?: {
    id: string
    connectedAt: number
    lastSeenAt: number
  }
}

export type ToolName =
  | 'project.info'
  | 'fs.list'
  | 'fs.read'
  | 'fs.write'
  | 'git.status'
  | 'git.diff'
  | 'process.run'

export interface ToolRequest {
  type: 'tool.request'
  id: string
  tool: ToolName
  input: Record<string, unknown>
}

export interface ToolResult {
  type: 'tool.result'
  id: string
  ok: boolean
  result?: unknown
  error?: {
    code: string
    message: string
  }
  durationMs: number
}

export interface RunnerHello {
  type: 'runner.hello'
  protocolVersion: number
  runnerId: string
  projectRoot: string
}

export interface RunnerWelcome {
  type: 'runner.welcome'
  protocolVersion: number
  serverTime: number
}

export interface PingFrame {
  type: 'ping' | 'pong'
  at: number
}

export interface UiEvent {
  type: 'ui.event'
  event: 'connected' | 'disconnected' | 'tool.start' | 'tool.finish' | 'error'
  at: number
  detail?: Record<string, unknown>
}

export type WireFrame = ToolRequest | ToolResult | RunnerHello | RunnerWelcome | PingFrame | UiEvent

export function encodeFrame(frame: WireFrame): Uint8Array {
  return encode(frame)
}

export function decodeFrame(data: ArrayBuffer | Uint8Array): WireFrame {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  return decode(bytes) as WireFrame
}
