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

## Temporary ChatGPT share

For a short-lived connection from ChatGPT to the current repository, install `cloudflared` and run:

```bash
pnpm share
```

The command generates a random temporary bearer credential, starts Web Harness on loopback, opens a Cloudflare Quick Tunnel, and prints the public HTTPS `/mcp` URL. In ChatGPT Developer Mode, create a custom MCP app, paste that URL, choose Access token / API key, paste the printed credential, then Scan Tools.

The share exists only while the foreground command is running. Ctrl-C stops both the local runtime and the tunnel. Use `WEB_HARNESS_CLOUDFLARED_BIN=/path/to/cloudflared` when the binary is not on `PATH`.

For local smoke testing without a tunnel:

```bash
pnpm share -- --tunnel none
```

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
