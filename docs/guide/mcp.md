# MCP clients

Web Harness exposes the runtime at `POST /mcp` using the official Model Context Protocol TypeScript SDK v2.

The endpoint targets MCP `2026-07-28` and the SDK handler also supports the established stateless 2025-era HTTP flow. The transport stays stateless at the MCP layer; repository continuity lives in Web Harness itself.

## Endpoint

Local default:

```text
http://127.0.0.1:4141/mcp
```

Authenticate with the same bearer token used by the REST tool API:

```http
Authorization: Bearer <WEB_HARNESS_TOKEN>
```

The default `change-me` token is accepted only from loopback. Use a long random token before exposing the server beyond the local machine.

## Tools

| MCP tool | Runtime tool | Effect |
| --- | --- | --- |
| `project_info` | `project.info` | Read project metadata |
| `fs_list` | `fs.list` | List a project directory |
| `fs_read` | `fs.read` | Read a UTF-8 file |
| `fs_write` | `fs.write` | Replace a UTF-8 file |
| `git_status` | `git.status` | Read concise Git status |
| `git_diff` | `git.diff` | Read unstaged diff |
| `process_run` | `process.run` | Execute one program with explicit argv |

The MCP adapter is intentionally thin. It validates public tool arguments, then enters the same local/remote runtime path used by the REST API and Web Console. There is no second filesystem or process authority path.

## Why the official SDK

MCP changed materially in the 2026-07-28 revision, including a stateless protocol core and updated HTTP routing rules. Web Harness uses `@modelcontextprotocol/server` and `@modelcontextprotocol/node` rather than maintaining a custom protocol implementation.

References:

- <https://modelcontextprotocol.io/>
- <https://ts.sdk.modelcontextprotocol.io/v2/>
