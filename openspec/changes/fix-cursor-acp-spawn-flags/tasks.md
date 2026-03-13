# Tasks: fix-cursor-acp-spawn-flags

- [x] 1. In `cursor-runner.ts`, update `spawn('agent', ['acp'])` to `spawn('agent', ['acp', '--workspace', groupDir, '--approve-mcps', '--force', '--trust'])`
- [x] 2. In `syncMcpJson()`, change `command: 'node'` to `command: process.execPath` in the nanoclaw entry
- [x] 3. In `buildMcpServers()`, change `command: 'node'` to `command: process.execPath`
- [x] 4. Run `cd container/agent-runner && npm run build` — zero TypeScript errors
- [ ] 5. Validate: run `cursor agent mcp list` — confirm `nanoclaw: ready` (not `needs approval`)
- [ ] 6. Validate: send a Zoom message via cursor backend — confirm nanoclaw `send_message` tool is available and response arrives
