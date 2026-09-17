import path from 'node:path'

export function resolveInsideRoot(root: string, requestedPath = '.'): string {
  const absoluteRoot = path.resolve(root)
  const candidate = path.resolve(absoluteRoot, requestedPath)
  const relative = path.relative(absoluteRoot, candidate)

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes configured project root')
  }

  return candidate
}
