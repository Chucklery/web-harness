import assert from 'node:assert/strict'
import type { IncomingMessage } from 'node:http'
import { test } from 'node:test'
import { isAuthorized, isUiWebSocketAuthorized } from './auth.js'

function request(headers: IncomingMessage['headers'], remoteAddress = '203.0.113.10') {
  return {
    headers,
    socket: { remoteAddress },
  } as unknown as IncomingMessage
}

test('default development token is accepted only from loopback', () => {
  assert.equal(isAuthorized(request({}, '127.0.0.1'), 'change-me'), true)
  assert.equal(isAuthorized(request({}, '::ffff:127.0.0.1'), 'change-me'), true)
  assert.equal(isAuthorized(request({}), 'change-me'), false)
})

test('bearer token comparison rejects mismatches', () => {
  assert.equal(isAuthorized(request({ authorization: 'Bearer secret' }), 'secret'), true)
  assert.equal(isAuthorized(request({ authorization: 'Bearer wrong' }), 'secret'), false)
})

test('UI websocket requires the stable protocol and a base64url token', () => {
  const encoded = Buffer.from('secret').toString('base64url')
  assert.equal(
    isUiWebSocketAuthorized(
      request({ 'sec-websocket-protocol': `web-harness.v1, auth.${encoded}` }),
      'secret',
    ),
    true,
  )
  assert.equal(
    isUiWebSocketAuthorized(request({ 'sec-websocket-protocol': `auth.${encoded}` }), 'secret'),
    false,
  )
  assert.equal(isUiWebSocketAuthorized(request({}), 'secret'), false)
})
