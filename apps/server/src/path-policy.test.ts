import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { ProjectPathPolicy, resolveInsideRoot } from './path-policy.js'

test('resolveInsideRoot keeps lexical paths inside root', () => {
  const root = path.resolve('/tmp/example')
  assert.equal(resolveInsideRoot(root, 'src/index.ts'), path.join(root, 'src/index.ts'))
})

test('resolveInsideRoot rejects parent traversal', () => {
  const root = path.resolve('/tmp/example')
  assert.throws(() => resolveInsideRoot(root, '../secret'))
})

test('ProjectPathPolicy rejects reads through a symlink that escapes the root', async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), 'web-harness-path-'))
  const root = path.join(base, 'repo')
  const outside = path.join(base, 'outside')
  t.after(() => rm(base, { recursive: true, force: true }))
  await mkdir(root)
  await mkdir(outside)
  await writeFile(path.join(outside, 'secret.txt'), 'secret')

  try {
    await symlink(outside, path.join(root, 'escape'), 'dir')
  } catch (error) {
    if (isSymlinkUnsupported(error)) return t.skip('symlinks are unavailable on this platform')
    throw error
  }

  const policy = new ProjectPathPolicy(root)
  await assert.rejects(
    () => policy.existing('escape/secret.txt'),
    /escapes configured project root/,
  )
})

test('ProjectPathPolicy rejects writes through an existing symlink that escapes the root', async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), 'web-harness-path-'))
  const root = path.join(base, 'repo')
  const outside = path.join(base, 'outside')
  t.after(() => rm(base, { recursive: true, force: true }))
  await mkdir(root)
  await mkdir(outside)
  const outsideTarget = path.join(outside, 'created.txt')

  try {
    await symlink(outsideTarget, path.join(root, 'escape.txt'), 'file')
  } catch (error) {
    if (isSymlinkUnsupported(error)) return t.skip('symlinks are unavailable on this platform')
    throw error
  }

  const policy = new ProjectPathPolicy(root)
  await assert.rejects(() => policy.writable('escape.txt'))
})

function isSymlinkUnsupported(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error.code === 'EPERM' || error.code === 'EACCES' || error.code === 'ENOSYS')
  )
}
