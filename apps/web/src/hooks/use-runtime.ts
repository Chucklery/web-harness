import { useCallback, useEffect, useState } from 'preact/hooks'
import { getSessionToken } from '../lib/api'

export interface RuntimeStatus {
  version: string
  protocolVersion: number
  mode: 'local' | 'remote'
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

export interface RuntimeEvent {
  event: string
  at: number
  detail?: Record<string, unknown>
}

export type SocketState = 'connecting' | 'connected' | 'reconnecting'

export function useRuntime() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null)
  const [events, setEvents] = useState<RuntimeEvent[]>([])
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [socketState, setSocketState] = useState<SocketState>('connecting')

  const refreshStatus = useCallback(async () => {
    const started = performance.now()
    try {
      const headers = new Headers()
      const token = getSessionToken()
      if (token) headers.set('Authorization', `Bearer ${token}`)
      const response = await fetch('/api/status', { cache: 'no-store', headers })
      if (!response.ok) throw new Error(`status ${response.status}`)
      const next = (await response.json()) as RuntimeStatus
      setStatus(next)
      setLatencyMs(Math.round((performance.now() - started) * 10) / 10)
    } catch {
      setStatus(null)
      setLatencyMs(null)
    }
  }, [])

  useEffect(() => {
    void refreshStatus()

    let disposed = false
    let reconnectTimer: number | undefined
    let socket: WebSocket | undefined
    let retryMs = 200

    const connect = () => {
      if (disposed) return
      setSocketState(retryMs === 200 ? 'connecting' : 'reconnecting')
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = `${protocol}//${location.host}/ws/ui`
      const token = getSessionToken()
      socket = token
        ? new WebSocket(url, ['web-harness.v1', `auth.${encodeBase64Url(token)}`])
        : new WebSocket(url)

      socket.addEventListener('open', () => {
        retryMs = 200
        setSocketState('connected')
      })

      socket.addEventListener('message', (message) => {
        try {
          const frame = JSON.parse(String(message.data)) as {
            type: string
            payload?: RuntimeStatus
            event?: string
            at?: number
            detail?: Record<string, unknown>
          }
          if (frame.type === 'status' && frame.payload) setStatus(frame.payload)
          if (frame.type === 'ui.event' && frame.event && frame.at) {
            setEvents((current) =>
              [
                {
                  event: frame.event as string,
                  at: frame.at as number,
                  ...(frame.detail ? { detail: frame.detail } : {}),
                },
                ...current,
              ].slice(0, 100),
            )
            if (frame.event === 'connected' || frame.event === 'disconnected') {
              void refreshStatus()
            }
          }
        } catch {
          // Ignore malformed UI-only frames and keep the observability socket alive.
        }
      })

      socket.addEventListener('close', () => {
        if (disposed) return
        setSocketState('reconnecting')
        const jitter = Math.floor(Math.random() * Math.min(retryMs * 0.2, 200))
        reconnectTimer = window.setTimeout(connect, retryMs + jitter)
        retryMs = Math.min(retryMs * 2, 3_000)
      })
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [refreshStatus])

  return { status, events, latencyMs, socketState, refreshStatus }
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}
