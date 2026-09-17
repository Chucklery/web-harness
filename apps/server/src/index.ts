import { loadConfig } from './config.js'
import { HarnessServer } from './server.js'

const config = loadConfig()
const server = new HarnessServer(config)
await server.listen()

console.log(`web-harness ${config.mode} runtime listening on http://${config.host}:${config.port}`)
console.log(`project root: ${config.projectRoot}`)
