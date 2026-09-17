import { useMemo, useState } from 'preact/hooks'
import { Explorer } from './components/explorer'
import { Toolbox } from './components/toolbox'
import { useRuntime } from './hooks/use-runtime'
import { getSessionToken, setSessionToken } from './lib/api'

export function App() {
  const { status, events, latencyMs, socketState, refreshStatus } = useRuntime()
  const [token, setToken] = useState(getSessionToken)
  const [showToken, setShowToken] = useState(false)

  const enabled = Boolean(status?.connected)
  const uptime = useMemo(() => formatUptime(status?.startedAt), [status?.startedAt, events.length])
  const activeProjectRoot =
    status?.runner?.projectRoot || status?.projectRoot || 'Waiting for runtime…'

  const saveToken = () => {
    setSessionToken(token)
    void refreshStatus()
  }

  return (
    <main class="shell">
      <header class="topbar">
        <div class="brand">
          <span class="brand-mark">WH</span>
          <div>
            <p class="eyebrow">LOCAL AI RUNTIME</p>
            <h1>Web Harness</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <div class="token-control">
            <input
              type={showToken ? 'text' : 'password'}
              value={token}
              onInput={(event) => setToken(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') saveToken()
              }}
              placeholder="Bearer token (session only)"
              aria-label="Bearer token"
              spellcheck={false}
            />
            <button type="button" onClick={() => setShowToken((value) => !value)}>
              {showToken ? 'Hide' : 'Show'}
            </button>
            <button type="button" onClick={saveToken}>
              Apply
            </button>
          </div>
          <span class={`pill ${enabled ? 'ok' : 'down'}`}>
            <i /> {enabled ? 'Runtime ready' : 'Runtime offline'}
          </span>
        </div>
      </header>

      <section class="hero">
        <div>
          <p class="label">Runtime</p>
          <h2>{status?.mode === 'remote' ? 'Remote runner' : 'Direct local'}</h2>
          <p class="muted">Short execution path, persistent transport, observable work.</p>
        </div>
        <div class="latency">
          <strong>{latencyMs === null ? '—' : `${latencyMs} ms`}</strong>
          <span>status round trip</span>
        </div>
      </section>

      <section class="metrics">
        <article class="metric project-metric">
          <span>Project</span>
          <strong title={activeProjectRoot}>{activeProjectRoot}</strong>
        </article>
        <article class="metric">
          <span>Mode</span>
          <strong>{status?.mode ?? '—'}</strong>
        </article>
        <article class="metric">
          <span>Protocol</span>
          <strong>v{status?.protocolVersion ?? '—'}</strong>
        </article>
        <article class="metric">
          <span>UI link</span>
          <strong>{socketState}</strong>
        </article>
        <article class="metric">
          <span>Uptime</span>
          <strong>{uptime}</strong>
        </article>
      </section>

      <div class="workspace-grid">
        <Explorer enabled={enabled} />
        <Toolbox enabled={enabled} />
      </div>

      <section class="activity-card">
        <div class="section-heading activity-heading">
          <div>
            <p class="label">Live activity</p>
            <h3>Runtime events</h3>
          </div>
          <span>{events.length} / 100</span>
        </div>
        <div class="events">
          {events.length === 0 ? (
            <p class="empty">No tool activity yet.</p>
          ) : (
            events.map((item, index) => (
              <div class="event" key={`${item.at}-${index}`}>
                <time>{new Date(item.at).toLocaleTimeString()}</time>
                <code>{item.event}</code>
                <span>{eventSummary(item.detail)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  )
}

function formatUptime(startedAt?: number): string {
  if (!startedAt) return '—'
  const seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function eventSummary(detail?: Record<string, unknown>): string {
  if (!detail) return ''
  const tool = typeof detail.tool === 'string' ? detail.tool : ''
  const surface = typeof detail.surface === 'string' ? detail.surface : ''
  const duration = typeof detail.durationMs === 'number' ? `${detail.durationMs} ms` : ''
  const ok = typeof detail.ok === 'boolean' ? (detail.ok ? 'ok' : 'failed') : ''
  return [tool, surface, duration, ok].filter(Boolean).join(' · ') || JSON.stringify(detail)
}
