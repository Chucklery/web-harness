import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export const UI_WEBSOCKET_PROTOCOL = 'web-harness.v1'

export function isAuthorized(request: IncomingMessage, expectedToken: string): boolean {
  if (usesLoopbackDefault(request, expectedToken)) return true

  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return false
  return tokenEquals(header.slice(7), expectedToken)
}

export function isUiWebSocketAuthorized(request: IncomingMessage, expectedToken: string): boolean {
  if (usesLoopbackDefault(request, expectedToken)) return true

  const header = request.headers['sec-websocket-protocol']
  const protocols = (Array.isArray(header) ? header : (header ?? '').split(',')).map((value) =>
    value.trim(),
  )
  if (!protocols.includes(UI_WEBSOCKET_PROTOCOL)) return false
  const authProtocol = protocols.find((value) => value.startsWith('auth.'))
  if (!authProtocol) return false

  try {
    const received = Buffer.from(authProtocol.slice('auth.'.length), 'base64url').toString('utf8')
    return tokenEquals(received, expectedToken)
  } catch {
    return false
  }
}

function usesLoopbackDefault(request: IncomingMessage, expectedToken: string): boolean {
  if (expectedToken !== 'change-me') return false
  const address = request.socket.remoteAddress
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function tokenEquals(receivedToken: string, expectedToken: string): boolean {
  const received = Buffer.from(receivedToken)
  const expected = Buffer.from(expectedToken)
  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}
