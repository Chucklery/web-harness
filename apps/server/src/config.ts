import path from 'node:path'

export interface RuntimeConfig {
  host: string
  port: number
  projectRoot: string
  token: string
  mode: 'local' | 'remote'
}

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim()
  return value && value.length > 0 ? value : fallback
}

export function loadConfig(): RuntimeConfig {
  const mode = env('WEB_HARNESS_MODE', 'local')
  if (mode !== 'local' && mode !== 'remote') {
    throw new Error('WEB_HARNESS_MODE must be "local" or "remote"')
  }

  const port = Number.parseInt(env('WEB_HARNESS_PORT', '4141'), 10)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error('WEB_HARNESS_PORT must be a valid TCP port')
  }

  return {
    host: env('WEB_HARNESS_HOST', '127.0.0.1'),
    port,
    projectRoot: path.resolve(env('WEB_HARNESS_PROJECT_ROOT', process.cwd())),
    token: env('WEB_HARNESS_TOKEN', 'change-me'),
    mode,
  }
}
