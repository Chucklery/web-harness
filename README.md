# Web Harness

A lightweight TypeScript runtime and web console for connecting AI coding clients to local repositories with a deliberately short, low-latency execution path.

> Status: early development / MVP.

## Why

WebCodex demonstrates a strong Server → Runner → Project trust boundary. Web Harness keeps that principle while optimizing for a lighter TypeScript stack and faster same-machine interaction:

- **Direct local mode** removes the extra Server → Runner hop when both live on one workstation.
- **Remote mode** uses one persistent WebSocket with MessagePack binary frames.
- `TCP_NODELAY`, keepalive, bounded frames, and disabled per-message compression keep interactive requests responsive.
- **Preact + Vite** provides a small web UI instead of requiring a desktop shell.
- **MCP 2026-07-28** is served through the official TypeScript SDK, with its stateless compatibility path for 2025-era clients.
- **VitePress + GitHub Pages** provides a standard public documentation site.

## Architecture

```text
Local (fastest)
AI client -> HTTP API -> in-process tool runtime -> repository
                   -> WebSocket -> web console

Remote
AI client -> HTTP API -> server -> persistent WS/MessagePack -> runner -> repository
                             -> WebSocket -> web console
```

## Quick start

```bash
corepack enable
pnpm install
cp .env.example .env
WEB_HARNESS_PROJECT_ROOT=/path/to/project pnpm dev
```

Open `http://127.0.0.1:4142` for the web console.

MCP clients connect to `http://127.0.0.1:4141/mcp` with `Authorization: Bearer <WEB_HARNESS_TOKEN>`.

To temporarily expose the current repository to ChatGPT through a Cloudflare Quick Tunnel:

```bash
pnpm share
```

`share` generates a fresh temporary credential, keeps the runtime loopback-only, starts `cloudflared`, and prints the HTTPS `/mcp` URL plus the credential to enter in ChatGPT. Install `cloudflared` first or set `WEB_HARNESS_CLOUDFLARED_BIN` to its path. Ctrl-C destroys the temporary runtime and tunnel.

## Included tools

- `project.info`
- `fs.list`
- `fs.read`
- `fs.write`
- `git.status`
- `git.diff`
- `process.run` (argv based; no implicit shell)

The same tools are exposed to MCP as `project_info`, `fs_list`, `fs_read`, `fs_write`, `git_status`, `git_diff`, and `process_run`.

## Repository layout

```text
apps/server       runtime server + optional remote runner
apps/web          Preact web console
packages/protocol typed MessagePack wire protocol
docs              VitePress documentation
.github            CI, Pages, issue/PR automation
```

## Development

```bash
pnpm dev
pnpm check
pnpm docs:dev
```

## Documentation

The docs site lives in `docs/` and is deployed with `.github/workflows/pages.yml`. The VitePress navigation links back to the GitHub repository and exposes per-page edit links.

GitHub Pages builds use the repository name as `DOCS_BASE`, so project-site deployments resolve correctly without hard-coding the account name.

## Security

This runtime can modify files and execute developer commands inside the configured project root. Read [SECURITY.md](SECURITY.md) and the [security guide](docs/guide/security.md) before exposing it outside loopback.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache License 2.0. See [LICENSE](LICENSE).
