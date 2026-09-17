# Contributing

## Development setup

```bash
corepack enable
pnpm install
pnpm check
```

Use Node.js 22 or newer. Keep changes focused and include tests for runtime/security-sensitive behavior.

## Pull requests

- Explain the user-visible problem and solution.
- Keep the hot path small; new dependencies need a clear reason.
- Add or update documentation for public behavior.
- Run `pnpm check` before opening the PR.
- Do not commit credentials, local paths, generated `dist/`, or `.env` files.

## Commit style

Conventional Commit prefixes are recommended: `feat:`, `fix:`, `docs:`, `refactor:`, `perf:`, `test:`, `chore:`.
