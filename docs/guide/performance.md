# Performance design

The performance target is **interactive latency**, not synthetic throughput alone.

## Hot-path decisions

1. **Direct local mode by default.** Same-machine deployments use an in-process tool runtime instead of serializing a request through a second daemon.
2. **Persistent connections.** Remote runners keep one WebSocket open and reuse it across tool calls.
3. **MessagePack on the runner link.** Internal frames are binary and compact; the browser console remains ordinary JSON for debuggability.
4. **No per-message compression.** Coding control frames are usually small; compression adds CPU and latency with little benefit.
5. **`TCP_NODELAY`.** Nagle buffering is disabled for the interactive runner and upgrade sockets.
6. **Keepalive instead of reconnect churn.** TCP keepalive starts at 15 seconds, while a 10-second WebSocket heartbeat removes half-open runner connections. Runner reconnect begins at 100 ms and backs off to 5 seconds with jitter.
7. **No shell wrapper on the common execution path.** `process.run` uses `execFile(command, args)` rather than spawning `/bin/sh -c`.
8. **Bounded UI work.** The web console retains only the latest 100 activity events.
9. **Fail fast under transport pressure.** A runner link with more than 1 MiB already buffered rejects new work instead of turning interactive calls into a long hidden queue.

## Reproducible local status benchmark

Start a local runtime with an explicit project and token, then point the benchmark at the same endpoint:

```bash
WEB_HARNESS_PORT=4149 \
WEB_HARNESS_PROJECT_ROOT=/path/to/project \
WEB_HARNESS_TOKEN=benchmark-secret \
pnpm --filter @web-harness/server start
```

In a second terminal:

```bash
WEB_HARNESS_URL=http://127.0.0.1:4149 \
WEB_HARNESS_TOKEN=benchmark-secret \
ITERATIONS=200 \
pnpm bench:http
```

The benchmark performs sequential authenticated `GET /api/status` requests and reports mean, p50, p95, and p99 wall-clock round-trip latency. Keep the machine, Node version, iteration count, and runtime mode constant when comparing changes.

A 200-request local-mode run on the development Mac during the 2026-09-17 validation measured approximately **0.68 ms p50**, **1.62 ms p95**, and **3.99 ms p99**. Treat this as a development baseline rather than a universal performance claim; repeat the benchmark on the target host before drawing conclusions.

## Reproducible tool-call benchmark

With the same local runtime running, measure representative tool calls through the REST adapter:

```bash
WEB_HARNESS_URL=http://127.0.0.1:4149 \
WEB_HARNESS_TOKEN=benchmark-secret \
ITERATIONS=50 \
WARMUP_ITERATIONS=5 \
pnpm bench:tools
```

The tool benchmark exercises `project.info`, `fs.read`, `git.status`, and `process.run` with `git --version`. `fs.read` defaults to `README.md`; set `BENCH_FILE` to another existing 1–16 KiB project-relative file when needed. Warm-up calls are excluded from the reported samples.

Use this benchmark to detect regressions in the actual execution path, not just HTTP routing. In particular, process-spawn latency should be evaluated separately from in-process tools because it is dominated by operating-system process creation and the executable itself.

A 50-sample local-mode run on the same development Mac measured these p50 latencies: `project.info` **1.58 ms**, `fs.read` **1.84 ms**, `git.status` **26.19 ms**, and `process.run` (`git --version`) **20.35 ms**. The corresponding p95 values were approximately **3.05 ms**, **3.30 ms**, **33.78 ms**, and **21.57 ms**. These are machine-specific development baselines, not product-wide guarantees.

## What to benchmark

Track p50/p95/p99 for:

- server status round trip
- `project.info`
- small file read (1–16 KiB)
- `git.status`
- process spawn (`git --version`)
- remote runner request round trip
- reconnect-to-ready time

Do not compare only raw requests/second. A coding runtime is sensitive to cold start, process spawn, serialization, reconnect, and UI rendering delays.
