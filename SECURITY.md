# Security Policy

## Supported versions

Only the latest minor release is supported during the pre-1.0 phase.

## Reporting a vulnerability

Do not open a public issue for vulnerabilities involving authentication bypass, path traversal, command execution outside the configured root, secret disclosure, or remote-code-execution primitives.

Use GitHub's private vulnerability reporting feature when enabled for the repository. Include reproduction steps, affected version/commit, impact, and any proposed mitigation.

## Runtime warning

Web Harness is a privileged developer tool. It can read/write repository files and execute argv-based processes. Production deployments must use a non-default token and TLS when traffic leaves loopback.
