export type ToolName =
  | 'project.info'
  | 'fs.list'
  | 'fs.read'
  | 'fs.write'
  | 'git.status'
  | 'git.diff'
  | 'process.run'

export interface ToolResponse<T> {
  ok: true
  result: T
  durationMs: number
}

interface ToolErrorResponse {
  ok?: false
  error?: string
}

const TOKEN_KEY = 'web-harness-token'

export function getSessionToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? ''
}

export function setSessionToken(token: string): void {
  const normalized = token.trim()
  if (normalized) sessionStorage.setItem(TOKEN_KEY, normalized)
  else sessionStorage.removeItem(TOKEN_KEY)
}

export async function callTool<T>(
  tool: ToolName,
  input: Record<string, unknown> = {},
): Promise<ToolResponse<T>> {
  const headers = new Headers({ 'Content-Type': 'application/json' })
  const token = getSessionToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(`/api/tools/${tool}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  const payload = (await response.json()) as ToolResponse<T> | ToolErrorResponse

  if (!response.ok || !payload.ok) {
    const message =
      'error' in payload && payload.error ? payload.error : `Request failed (${response.status})`
    throw new Error(message)
  }

  return payload
}
