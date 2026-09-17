# Security model

Web Harness can read, modify, and execute code inside a configured repository. Treat it as a privileged developer tool.

## Boundaries

- The runtime is bound to one explicit `WEB_HARNESS_PROJECT_ROOT`.
- File paths and process working directories are resolved against that root and traversal is rejected.
- Existing paths are canonicalized before use, so a symlink inside the repository cannot silently redirect reads, writes, or process working directories outside the configured root.
- Runtime status, REST tool calls, MCP requests, remote runner connections, and the Web UI event socket require the configured token.
- The browser console keeps its token in `sessionStorage` only. For the WebSocket handshake it offers a fixed `web-harness.v1` subprotocol plus an `auth.<base64url-token>` credential; the server selects and echoes only the fixed protocol, so the credential is not reflected in the handshake response.
- The default `change-me` token is accepted only from loopback connections, including IPv4-mapped loopback addresses.
- `process.run` uses an argv API rather than an implicit shell.
- Request sizes, file sizes, process output, and execution time are bounded.

## Production recommendations

- Replace the default token with a random secret.
- Put public deployments behind TLS.
- Run the process as a non-admin user.
- Register only repositories that the AI client is expected to access.
- Keep Git enabled so every file change is reviewable.
- Do not expose the server directly to the public internet without authentication and TLS.

## Not yet included

The MVP does not claim multi-tenant isolation, sandboxing, OAuth, policy approvals, secret redaction, or protection from a hostile local process racing filesystem links between validation and use. Those require explicit threat-model-driven design rather than hidden defaults.
