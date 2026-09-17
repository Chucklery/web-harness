import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const args = process.argv.slice(2)
const tunnel = readOption(args, '--tunnel') ?? 'cloudflare'
const port = Number.parseInt(readOption(args, '--port') ?? '4141', 10)
const projectRoot = path.resolve(readOption(args, '--project') ?? process.cwd())
const cloudflaredBin = process.env.WEB_HARNESS_CLOUDFLARED_BIN?.trim() || 'cloudflared'

if (!['cloudflare', 'none'].includes(tunnel)) {
  fail(`unsupported tunnel: ${tunnel}. Expected cloudflare or none.`)
}
if (!Number.isInteger(port) || port <= 0 || port > 65535) fail('--port must be a valid TCP port')

await access(projectRoot)

const token = `wh_${randomBytes(24).toString('base64url')}`
const localBaseUrl = `http://127.0.0.1:${port}`
const children = new Set()
let stopping = false

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    void stop(signal)
  })
}

try {
  const server = start(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', 'apps/server/src/index.ts'],
    {
      WEB_HARNESS_HOST: '127.0.0.1',
      WEB_HARNESS_PORT: String(port),
      WEB_HARNESS_PROJECT_ROOT: projectRoot,
      WEB_HARNESS_TOKEN: token,
      WEB_HARNESS_MODE: 'local',
    },
  )

  server.stderr.pipe(process.stderr)
  await waitForMcp(localBaseUrl, token, server)

  if (tunnel === 'none') {
    printReady(`${localBaseUrl}/mcp`, token, projectRoot, 'none')
    await waitForExit(server)
    process.exitCode = server.exitCode ?? 0
  } else {
    const cloudflared = start(cloudflaredBin, ['tunnel', '--no-autoupdate', '--url', localBaseUrl])
    const publicBaseUrl = await waitForCloudflareUrl(cloudflared)
    printReady(`${publicBaseUrl}/mcp`, token, projectRoot, 'cloudflare')

    const exit = await Promise.race([
      waitForExit(server).then(() => ({ name: 'server', code: server.exitCode })),
      waitForExit(cloudflared).then(() => ({ name: 'cloudflared', code: cloudflared.exitCode })),
    ])
    if (!stopping)
      throw new Error(`${exit.name} exited unexpectedly with code ${exit.code ?? 'unknown'}`)
  }
} catch (error) {
  if (!stopping) {
    console.error(
      `web-harness share failed: ${error instanceof Error ? error.message : String(error)}`,
    )
    process.exitCode = 1
  }
} finally {
  await stop()
}

function start(executable, childArgs, extraEnv = {}) {
  const child = spawn(executable, childArgs, {
    cwd: path.resolve('.'),
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  children.add(child)
  child.once('exit', () => children.delete(child))
  child.once('error', () => children.delete(child))
  return child
}

async function waitForMcp(baseUrl, credential, child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`server exited with code ${child.exitCode}`)
    try {
      const response = await fetch(`${baseUrl}/api/status`, {
        headers: { Authorization: `Bearer ${credential}` },
        signal: AbortSignal.timeout(1_000),
      })
      if (response.ok) return
    } catch {}
    await delay(100)
  }
  throw new Error('local server did not become ready within 15 seconds')
}

function waitForCloudflareUrl(child) {
  return new Promise((resolve, reject) => {
    let buffer = ''
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('cloudflared did not publish a Quick Tunnel URL within 30 seconds'))
    }, 30_000)

    const onData = (chunk) => {
      const text = chunk.toString()
      process.stderr.write(text)
      buffer = `${buffer}${text}`.slice(-32_768)
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i)
      if (!match) return
      cleanup()
      resolve(match[0].replace(/\/$/, ''))
    }
    const onError = (error) => {
      cleanup()
      reject(
        new Error(
          error?.code === 'ENOENT'
            ? `cloudflared was not found. Install it or set WEB_HARNESS_CLOUDFLARED_BIN.`
            : `cloudflared failed to start: ${error.message}`,
        ),
      )
    }
    const onExit = (code) => {
      cleanup()
      reject(new Error(`cloudflared exited before becoming ready with code ${code ?? 'unknown'}`))
    }
    const cleanup = () => {
      clearTimeout(timer)
      child.stderr.off('data', onData)
      child.off('error', onError)
      child.off('exit', onExit)
    }

    child.stderr.on('data', onData)
    child.once('error', onError)
    child.once('exit', onExit)
  })
}

function printReady(mcpUrl, credential, root, tunnelName) {
  console.log('')
  console.log('Web Harness ready')
  console.log(`Project:    ${root}`)
  console.log(`Tunnel:     ${tunnelName}`)
  console.log(`MCP URL:    ${mcpUrl}`)
  console.log(`Credential: ${credential}`)
  console.log('')
  if (tunnelName === 'cloudflare') {
    console.log(
      'ChatGPT: create a custom MCP app, use the MCP URL above, choose Access token / API key,',
    )
    console.log('paste the temporary Credential, then Scan Tools.')
    console.log('This credential and tunnel stop working when this command exits.')
  } else {
    console.log(
      'Local-only mode: use the MCP URL and Bearer credential from a client on this machine.',
    )
  }
  console.log('Press Ctrl-C to stop sharing.')
  console.log('')
}

async function stop(signal) {
  if (stopping) return
  stopping = true
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal === 'SIGTERM' ? 'SIGTERM' : 'SIGINT')
  }
  await Promise.all([...children].map((child) => waitForExit(child, 2_000)))
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }
}

function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve()
  return new Promise((resolve) => {
    child.once('exit', resolve)
    if (timeoutMs !== undefined) setTimeout(resolve, timeoutMs).unref()
  })
}

function readOption(values, name) {
  const index = values.indexOf(name)
  if (index === -1) return undefined
  const value = values[index + 1]
  if (!value || value.startsWith('--')) fail(`${name} requires a value`)
  return value
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function fail(message) {
  console.error(`web-harness share: ${message}`)
  process.exit(2)
}
