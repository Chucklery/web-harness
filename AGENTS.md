# AGENTS.md

## Project intent

Keep Web Harness small, measurable, and latency-oriented. Prefer a short, typed execution path over framework layers.

## Rules

- Use TypeScript strict mode.
- Preserve the project-root path boundary.
- Prefer structured argv process execution over shell strings.
- Avoid adding runtime dependencies unless they materially improve correctness or latency.
- Keep runner frames backward-compatible within a protocol version.
- Add tests for path/auth/protocol boundary changes.
- Update docs for user-visible configuration or behavior changes.
- Run `pnpm check` before completing a change.
