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
