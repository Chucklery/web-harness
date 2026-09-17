---
layout: home

hero:
  name: Web Harness
  text: Fast local AI coding runtime
  tagline: TypeScript-first, web-visible, small hot path, persistent connections.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Architecture
      link: /guide/architecture

features:
  - title: Direct local fast path
    details: Server and repository runtime can run in one process, avoiding an unnecessary network hop for the common personal-workstation case.
  - title: Persistent binary transport
    details: Remote runners use long-lived WebSocket connections with MessagePack, TCP_NODELAY, keepalive, and compression disabled for small interactive frames.
  - title: Web-native observability
    details: A compact Preact console exposes connection state, runtime mode, latency, and live tool activity without shipping a desktop shell.
  - title: Open-source ready
    details: CI, GitHub Pages, security policy, contribution guide, issue templates, code of conduct, and a documented protocol are included from day one.
---
