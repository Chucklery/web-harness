# Runner protocol

Remote runner traffic uses WebSocket binary frames encoded with MessagePack.

Current protocol version: `1`.

## Handshake

Runner sends:

```ts
{
  type: 'runner.hello'
  protocolVersion: 1
  runnerId: string
  projectRoot: string
}
```

Server replies:

```ts
{
  type: 'runner.welcome'
  protocolVersion: 1
  serverTime: number
}
```

## Tool request

```ts
{
  type: 'tool.request'
  id: string
  tool: 'project.info' | 'fs.list' | 'fs.read' | 'fs.write' | 'git.status' | 'git.diff' | 'process.run'
  input: Record<string, unknown>
}
```

Every request receives exactly one `tool.result` frame unless the connection is lost. The server rejects mismatched protocol versions before registering the runner.

Malformed MessagePack frames are rejected at the protocol boundary. If a runner reconnects with the same or a new runner id, the newer socket becomes authoritative and the previous socket is terminated so stale close/heartbeat events cannot detach the active runner.
