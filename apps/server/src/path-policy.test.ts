import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { resolveInsideRoot } from './path-policy.js'

test('resolveInsideRoot keeps paths inside root', () => {
  const root = path.resolve('/tmp/example')
  assert.equal(resolveInsideRoot(root, 'src/index.ts'), path.join(root, 'src/index.ts'))
})

test('resolveInsideRoot rejects parent traversal', () => {
  const root = path.resolve('/tmp/example')
  assert.throws(() => resolveInsideRoot(root, '../secret'))
})
