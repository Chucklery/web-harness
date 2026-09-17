const base = process.env.WEB_HARNESS_URL ?? 'http://127.0.0.1:4141'
const iterations = Number(process.env.ITERATIONS ?? 50)
const warmupIterations = Number(process.env.WARMUP_ITERATIONS ?? 5)
const token = process.env.WEB_HARNESS_TOKEN?.trim()
const smallFile = process.env.BENCH_FILE?.trim() || 'README.md'

if (!Number.isInteger(iterations) || iterations <= 0)
  throw new Error('ITERATIONS must be a positive integer')
if (!Number.isInteger(warmupIterations) || warmupIterations < 0) {
  throw new Error('WARMUP_ITERATIONS must be a non-negative integer')
}

const cases = [
  { name: 'project.info', input: {} },
  { name: 'fs.read', input: { path: smallFile } },
  { name: 'git.status', input: {} },
  { name: 'process.run', input: { command: 'git', args: ['--version'], cwd: '.' } },
]

const headers = {
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
}

const results = []
for (const benchmark of cases) {
  for (let index = 0; index < warmupIterations; index += 1) {
    await invoke(benchmark.name, benchmark.input)
  }

  const samples = []
  for (let index = 0; index < iterations; index += 1) {
    const start = performance.now()
    await invoke(benchmark.name, benchmark.input)
    samples.push(performance.now() - start)
  }

  samples.sort((a, b) => a - b)
  const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))]
  results.push({
    tool: benchmark.name,
    iterations,
    meanMs: samples.reduce((sum, item) => sum + item, 0) / samples.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    p99Ms: percentile(0.99),
  })
}

console.log(JSON.stringify({ warmupIterations, smallFile, results }, null, 2))

async function invoke(tool, input) {
  const response = await fetch(`${base}/api/tools/${tool}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(`${tool}: HTTP ${response.status}${message ? `: ${message}` : ''}`)
  }
  await response.arrayBuffer()
}
