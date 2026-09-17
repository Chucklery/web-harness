import { timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export function isAuthorized(request: IncomingMessage, expectedToken: string): boolean {
  if (expectedToken === 'change-me') return request.socket.remoteAddress === '127.0.0.1' || request.socket.remoteAddress === '::1'

  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return false

  const received = Buffer.from(header.slice(7))
  const expected = Buffer.from(expectedToken)
  if (received.length !== expected.length) return false
  return timingSafeEqual(received, expected)
}
