import { execFile } from 'node:child_process'
import { readdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import type { ToolName } from '@web-harness/protocol'
import { resolveInsideRoot } from './path-policy.js'

const execFileAsync = promisify(execFile)

export class LocalToolRuntime {
  public constructor(private readonly projectRoot: string) {}

  async execute(tool: ToolName, input: Record<string, unknown>): Promise<unknown> {
    switch (tool) {
      case 'project.info':
        return this.projectInfo()
      case 'fs.list':
        return this.list(String(input.path ?? '.'))
      case 'fs.read':
        return this.read(String(input.path ?? ''))
      case 'fs.write':
        return this.write(String(input.path ?? ''), String(input.content ?? ''))
      case 'git.status':
        return this.git(['status', '--short', '--branch'])
      case 'git.diff':
        return this.git(['diff', '--', ...(Array.isArray(input.paths) ? input.paths.map(String) : [])])
      case 'process.run':
        return this.runProcess(input)
    }
  }

  private async projectInfo() {
    const info = await stat(this.projectRoot)
    return {
      root: this.projectRoot,
      directory: info.isDirectory(),
      name: path.basename(this.projectRoot),
    }
  }

  private async list(requestedPath: string) {
    const directory = resolveInsideRoot(this.projectRoot, requestedPath)
    const entries = await readdir(directory, { withFileTypes: true })
    return entries
      .filter((entry) => entry.name !== 'node_modules' && entry.name !== '.git')
      .slice(0, 500)
      .map((entry) => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
      }))
  }

  private async read(requestedPath: string) {
    if (!requestedPath) throw new Error('path is required')
    const file = resolveInsideRoot(this.projectRoot, requestedPath)
    const content = await readFile(file, 'utf8')
    if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
      throw new Error('File is larger than the 2 MiB read limit')
    }
    return { path: requestedPath, content }
  }

  private async write(requestedPath: string, content: string) {
    if (!requestedPath) throw new Error('path is required')
    if (Buffer.byteLength(content, 'utf8') > 2 * 1024 * 1024) {
      throw new Error('Content is larger than the 2 MiB write limit')
    }
    const file = resolveInsideRoot(this.projectRoot, requestedPath)
    await writeFile(file, content, 'utf8')
    return { path: requestedPath, bytes: Buffer.byteLength(content, 'utf8') }
  }

  private async git(args: string[]) {
    const startedAt = performance.now()
    const { stdout, stderr } = await execFileAsync('git', args, {
      cwd: this.projectRoot,
      timeout: 10_000,
      maxBuffer: 4 * 1024 * 1024,
      windowsHide: true,
    })
    return { stdout, stderr, durationMs: Math.round((performance.now() - startedAt) * 100) / 100 }
  }

  private async runProcess(input: Record<string, unknown>) {
    const command = String(input.command ?? '')
    if (!command) throw new Error('command is required')

    const args = Array.isArray(input.args) ? input.args.map(String) : []
    const cwd = resolveInsideRoot(this.projectRoot, String(input.cwd ?? '.'))
    const timeoutMs = Math.min(Math.max(Number(input.timeoutMs ?? 30_000), 100), 120_000)
    const startedAt = performance.now()

    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd,
      timeout: timeoutMs,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        CI: '1',
        NO_COLOR: '1',
      },
    })

    return {
      command,
      args,
      stdout,
      stderr,
      durationMs: Math.round((performance.now() - startedAt) * 100) / 100,
    }
  }
}
