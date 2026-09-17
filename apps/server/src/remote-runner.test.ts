import assert from 'node:assert/strict'
import { test } from 'node:test'
import type WebSocket from 'ws'
import { RemoteRunnerBridge } from './remote-runner.js'

function fakeSocket() {
  return {
    readyState: 1,
    bufferedAmount: 0,
    terminated: false,
    terminate() {
      this.terminated = true
    },
  }
}

test('a newer runner connection replaces the previous socket without stale detach', () => {
  const bridge = new RemoteRunnerBridge()
  const first = fakeSocket()
  const second = fakeSocket()

  bridge.attach(first as unknown as WebSocket, 'runner-a', '/repo/a')
  bridge.attach(second as unknown as WebSocket, 'runner-b', '/repo/b')

  assert.equal(first.terminated, true)
  assert.deepEqual(bridge.status, {
    id: 'runner-b',
    projectRoot: '/repo/b',
    connectedAt: bridge.status?.connectedAt,
    lastSeenAt: bridge.status?.lastSeenAt,
  })
  assert.equal(bridge.detach(first as unknown as WebSocket), false)
  assert.equal(bridge.status?.id, 'runner-b')
  assert.equal(bridge.detach(second as unknown as WebSocket), true)
  assert.equal(bridge.status, undefined)
})

test('stale runner heartbeats do not update the active connection', () => {
  const bridge = new RemoteRunnerBridge()
  const first = fakeSocket()
  const second = fakeSocket()

  bridge.attach(first as unknown as WebSocket, 'runner-a', '/repo/a')
  bridge.attach(second as unknown as WebSocket, 'runner-b', '/repo/b')

  assert.equal(bridge.touch(first as unknown as WebSocket), false)
  assert.equal(bridge.touch(second as unknown as WebSocket), true)
})
