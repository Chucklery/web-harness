import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const port = Number(process.env.WEB_HARNESS_BENCH_PORT ?? 4150)
const iterations = Number(process.env.ITERATIONS ?? 50)
const token = process.env.WEB_HARNESS_TOKEN?.trim() || 'web-harness-benchmark'
const base = `http://127.0.0.1:${port}`
const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

if (!Number.isInteger(port) || port <= 0 || port > 65535)
  throw new Error('WEB_HARNESS_BENCH_PORT must be a valid TCP port')
if (!Number.isInteger(iterations) || iterations <= 0)
  throw new Error('ITERATIONS must be a positive integer')

let shuttingDown = false
const children = []
try {
  const server = start('server', ['apps/server/src/index.ts'], {
    WEB_HARNESS_MODE: 'remote',
    WEB_HARNESS_PORT: String(port),
    WEB_HARNESS_PROJECT_ROOT: projectRoot,
    WEB_HARNESS_TOKEN: token,
  })
  children.push(server)
  await waitForStatus(false)

  const runnerStartedAt = performance.now()
  const runner = start('runner', ['apps/server/src/runner.ts'], {
    WEB_HARNESS_MODE: 'local',
    WEB_HARNESS_PROJECT_ROOT: projectRoot,
    WEB_HARNESS_TOKEN: token,
    WEB_HARNESS_SERVER_URL: `ws://127.0.0.1:${port}/ws/runner`,
  })
  children.push(runner)
  await waitForStatus(true)
  const runnerReadyMs = performance.now() - runnerStartedAt

  const samples = []
  for (let index = 0; index < iterations; index += 1) {
    const startedAt = performance.now()
    await invokeProjectInfo()
    samples.push(performance.now() - startedAt)
  }

  samples.sort((a, b) => a - b)
  const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))]
  console.log(
    JSON.stringify(
      {
        iterations,
        runnerReadyMs,
        projectInfo: {
          meanMs: samples.reduce((sum, item) => sum + item, 0) / samples.length,
          p50Ms: percentile(0.5),
          p95Ms: percentile(0.95),
          p99Ms: percentile(0.99),
        },
      },
      null,
      2,
    ),
  )
} finally {
  shuttingDown = true
  for (const child of children.reverse()) child.kill()
}

function start(label, scriptArgs, extraEnv) {
  const child = spawn(process.execPath, [tsxCli, ...scriptArgs], {
    cwd: projectRoot,
    env: { ...process.env, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-8_000)
  })
  child.once('exit', (code, signal) => {
    if (shuttingDown || code === 0 || signal) return
    process.stderr.write(`${label} exited with code ${code}\n${stderr}`)
  })
  return child
}

async function waitForStatus(expectConnected) {
  const deadline = Date.now() + 10_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${base}/api/status`, { headers: authorizationHeaders() })
      if (response.ok) {
        const status = await response.json()
        if (Boolean(status.connected) === expectConnected) return
      }
    } catch (error) {
      lastError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  throw new Error(
    `Timed out waiting for connected=${expectConnected}${lastError ? `: ${lastError}` : ''}`,
  )
}

async function invokeProjectInfo() {
  const response = await fetch(`${base}/api/tools/project.info`, {
    method: 'POST',
    headers: { ...authorizationHeaders(), 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!response.ok)
    throw new Error(`project.info: HTTP ${response.status}: ${await response.text()}`)
  await response.arrayBuffer()
}

function authorizationHeaders() {
  return { Authorization: `Bearer ${token}` }
}
