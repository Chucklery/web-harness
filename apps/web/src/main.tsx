import { render } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import './styles.css'

type Status = {
  version: string
  protocolVersion: number
  mode: 'local' | 'remote'
  connected: boolean
  projectRoot: string
  startedAt: number
  runner?: { id: string; connectedAt: number; lastSeenAt: number }
}

type EventItem = {
  event: string
  at: number
  detail?: Record<string, unknown>
}

function App() {
  const [status, setStatus] = useState<Status | null>(null)
  const [events, setEvents] = useState<EventItem[]>([])
  const [latency, setLatency] = useState<number | null>(null)

  useEffect(() => {
    const started = performance.now()
    fetch('/api/status')
      .then((response) => response.json())
      .then((next: Status) => {
        setStatus(next)
        setLatency(Math.round((performance.now() - started) * 10) / 10)
      })
      .catch(() => setStatus(null))

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${protocol}//${location.host}/ws/ui`)
    socket.addEventListener('message', (message) => {
      const frame = JSON.parse(String(message.data)) as { type: string; payload?: Status; event?: string; at?: number; detail?: Record<string, unknown> }
      if (frame.type === 'status' && frame.payload) setStatus(frame.payload)
      if (frame.type === 'ui.event' && frame.event && frame.at) {
        setEvents((current) => [
          { event: frame.event!, at: frame.at!, ...(frame.detail ? { detail: frame.detail } : {}) },
          ...current,
        ].slice(0, 100))
      }
    })
    return () => socket.close()
  }, [])

  const uptime = useMemo(() => {
    if (!status) return '—'
    const seconds = Math.max(0, Math.floor((Date.now() - status.startedAt) / 1000))
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }, [status, events.length])

  return (
    <main class="shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">LOCAL AI RUNTIME</p>
          <h1>Web Harness</h1>
        </div>
        <span class={`pill ${status?.connected ? 'ok' : 'down'}`}>
          <i /> {status?.connected ? 'Connected' : 'Disconnected'}
        </span>
      </header>

      <section class="hero">
        <div>
          <p class="label">Runtime</p>
          <h2>{status?.mode === 'remote' ? 'Remote runner' : 'Direct local'}</h2>
          <p class="muted">Low-latency coding runtime with a deliberately small hot path.</p>
        </div>
        <div class="latency">
          <strong>{latency === null ? '—' : `${latency} ms`}</strong>
          <span>status round trip</span>
        </div>
      </section>

      <section class="grid">
        <article class="card">
          <span>Project</span>
          <strong>{status?.projectRoot ?? 'Waiting for runtime…'}</strong>
        </article>
        <article class="card">
          <span>Mode</span>
          <strong>{status?.mode ?? '—'}</strong>
        </article>
        <article class="card">
          <span>Protocol</span>
          <strong>v{status?.protocolVersion ?? '—'}</strong>
        </article>
        <article class="card">
          <span>Uptime</span>
          <strong>{uptime}</strong>
        </article>
      </section>

      <section class="panel">
        <div class="panel-title">
          <div>
            <p class="label">Live activity</p>
            <h3>Runtime events</h3>
          </div>
          <span>{events.length} buffered</span>
        </div>
        <div class="events">
          {events.length === 0 ? (
            <p class="empty">No tool activity yet.</p>
          ) : (
            events.map((item, index) => (
              <div class="event" key={`${item.at}-${index}`}>
                <time>{new Date(item.at).toLocaleTimeString()}</time>
                <code>{item.event}</code>
                <span>{item.detail ? JSON.stringify(item.detail) : ''}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

render(<App />, document.getElementById('app')!)
