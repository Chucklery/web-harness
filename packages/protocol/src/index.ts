import { decode, encode } from '@msgpack/msgpack'

export const PROTOCOL_VERSION = 1 as const
export const TOOL_NAMES = [
  'project.info',
  'fs.list',
  'fs.read',
  'fs.write',
  'git.status',
  'git.diff',
  'process.run',
] as const

export type ConnectionMode = 'local' | 'remote'
export type ToolName = (typeof TOOL_NAMES)[number]

export interface RuntimeStatus {
  version: string
  protocolVersion: number
  mode: ConnectionMode
  connected: boolean
  projectRoot: string
  startedAt: number
  runner?: {
    id: string
    projectRoot: string
    connectedAt: number
    lastSeenAt: number
  }
}

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
  protocolVersion: typeof PROTOCOL_VERSION
  runnerId: string
  projectRoot: string
}

export interface RunnerWelcome {
  type: 'runner.welcome'
  protocolVersion: typeof PROTOCOL_VERSION
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
  const decoded = decode(bytes)
  if (!isWireFrame(decoded)) throw new Error('Invalid runner protocol frame')
  return decoded
}

export function isToolName(value: unknown): value is ToolName {
  return typeof value === 'string' && (TOOL_NAMES as readonly string[]).includes(value)
}

function isWireFrame(value: unknown): value is WireFrame {
  if (!isRecord(value) || typeof value.type !== 'string') return false

  switch (value.type) {
    case 'runner.hello':
      return (
        value.protocolVersion === PROTOCOL_VERSION &&
        isNonEmptyString(value.runnerId) &&
        isNonEmptyString(value.projectRoot)
      )
    case 'runner.welcome':
      return value.protocolVersion === PROTOCOL_VERSION && typeof value.serverTime === 'number'
    case 'tool.request':
      return isNonEmptyString(value.id) && isToolName(value.tool) && isRecord(value.input)
    case 'tool.result':
      return (
        isNonEmptyString(value.id) &&
        typeof value.ok === 'boolean' &&
        typeof value.durationMs === 'number' &&
        (value.error === undefined ||
          (isRecord(value.error) &&
            typeof value.error.code === 'string' &&
            typeof value.error.message === 'string'))
      )
    case 'ping':
    case 'pong':
      return typeof value.at === 'number'
    case 'ui.event':
      return (
        typeof value.event === 'string' &&
        ['connected', 'disconnected', 'tool.start', 'tool.finish', 'error'].includes(value.event) &&
        typeof value.at === 'number' &&
        (value.detail === undefined || isRecord(value.detail))
      )
    default:
      return false
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
