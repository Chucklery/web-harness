const base = process.env.WEB_HARNESS_URL ?? 'http://127.0.0.1:4141'
const iterations = Number(process.env.ITERATIONS ?? 200)
const samples = []

for (let index = 0; index < iterations; index += 1) {
  const start = performance.now()
  const response = await fetch(`${base}/api/status`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  await response.arrayBuffer()
  samples.push(performance.now() - start)
}

samples.sort((a, b) => a - b)
const percentile = (p) => samples[Math.min(samples.length - 1, Math.floor(samples.length * p))]
const mean = samples.reduce((sum, item) => sum + item, 0) / samples.length
console.log(
  JSON.stringify(
    {
      iterations,
      meanMs: mean,
      p50Ms: percentile(0.5),
      p95Ms: percentile(0.95),
      p99Ms: percentile(0.99),
    },
    null,
    2,
  ),
)
