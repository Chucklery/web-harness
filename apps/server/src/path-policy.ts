import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

export function resolveInsideRoot(root: string, requestedPath = '.'): string {
  const absoluteRoot = path.resolve(root)
  const candidate = path.resolve(absoluteRoot, requestedPath)
  assertInside(absoluteRoot, candidate)
  return candidate
}

export class ProjectPathPolicy {
  private readonly lexicalRoot: string
  private readonly realRoot: Promise<string>

  constructor(root: string) {
    this.lexicalRoot = path.resolve(root)
    this.realRoot = realpath(this.lexicalRoot)
  }

  async existing(requestedPath = '.'): Promise<string> {
    const candidate = resolveInsideRoot(this.lexicalRoot, requestedPath)
    const [canonicalRoot, canonicalCandidate] = await Promise.all([
      this.realRoot,
      realpath(candidate),
    ])
    assertInside(canonicalRoot, canonicalCandidate)
    return canonicalCandidate
  }

  async writable(requestedPath: string): Promise<string> {
    const candidate = resolveInsideRoot(this.lexicalRoot, requestedPath)
    const canonicalRoot = await this.realRoot
    let exists = true

    try {
      await lstat(candidate)
    } catch (error) {
      if (!isNotFound(error)) throw error
      exists = false
    }

    if (exists) {
      const canonicalCandidate = await realpath(candidate)
      assertInside(canonicalRoot, canonicalCandidate)
      return candidate
    }

    const canonicalParent = await realpath(path.dirname(candidate))
    assertInside(canonicalRoot, canonicalParent)
    return candidate
  }
}

function assertInside(root: string, candidate: string): void {
  const relative = path.relative(root, candidate)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes configured project root')
  }
}

function isNotFound(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
