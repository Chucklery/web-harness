# Release checklist

Before a public release:

- Confirm `pnpm-lock.yaml` is up to date; CI and Pages installs use `--frozen-lockfile`.
- Replace local development tokens and verify TLS for non-loopback deployments.
- Run `pnpm check` on Node.js 22.
- Run `pnpm bench:http` against a release build and record p50/p95/p99.
- Measure remote runner reconnect-to-ready time under a real WAN link.
- Enable GitHub private vulnerability reporting.
- Configure GitHub Pages to use **GitHub Actions** as the deployment source.
- Verify the VitePress base path resolves to the repository name used by GitHub Pages.
