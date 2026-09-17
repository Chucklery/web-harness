# Getting started

## Requirements

- Node.js 22+
- pnpm 10+
- Git

## Install

```bash
pnpm install
cp .env.example .env
```

For the lowest latency on the same machine, keep the default:

```bash
WEB_HARNESS_MODE=local
WEB_HARNESS_PROJECT_ROOT=/absolute/path/to/project
WEB_HARNESS_TOKEN=replace-with-a-long-random-token
```

Then start the development runtime:

```bash
pnpm dev
```

- Runtime API: `http://127.0.0.1:4141`
- MCP endpoint: `http://127.0.0.1:4141/mcp`
- Web console: `http://127.0.0.1:4142`

MCP and REST requests use the configured token as a bearer credential. Enter the same token in the Web console; it is retained only for the current browser session. See [MCP clients](./mcp.md) for the tool map and protocol notes.

## Production build

```bash
pnpm build
pnpm --filter @web-harness/server start
```

The server serves the built web console when `apps/web/dist` exists.

## Remote runner mode

Set the server to remote mode:

```bash
WEB_HARNESS_MODE=remote pnpm --filter @web-harness/server start
```

On the repository machine:

```bash
WEB_HARNESS_SERVER_URL=wss://your-host/ws/runner \
WEB_HARNESS_PROJECT_ROOT=/path/to/repo \
WEB_HARNESS_TOKEN=... \
pnpm --filter @web-harness/server runner
```
