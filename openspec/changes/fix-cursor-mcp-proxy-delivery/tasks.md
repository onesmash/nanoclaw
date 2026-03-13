## Tasks

### 1. cursor-runner: write workspace mcp.json before spawning agent
- [x] 1.1 After `waitForProxy(port)`, write `{groupDir}/.cursor/mcp.json` with `{ mcpServers: { 'mcp-proxy': { url: 'http://127.0.0.1:<port>' } } }` (creating `.cursor/` dir if absent)
- [x] 1.2 Call `preApproveMcps(groupDir)` after writing the file (existing function; approves any unapproved MCP entries via `agent mcp enable`)
- [x] 1.3 Replace `mcpServers: [...]` with `mcpServers: []` in both `newSession` and `loadSession` calls

### 2. mcp-proxy: per-session transport pattern
- [x] 2.1 Replace single/stateless `StreamableHTTPServerTransport` instance with a `Map<string, StreamableHTTPServerTransport>` keyed by session ID
- [x] 2.2 On each new request (no matching `mcp-session-id`): create fresh `StreamableHTTPServerTransport({ sessionIdGenerator: () => randomUUID(), onsessioninitialized })` + new `Server` instance, connect them, handle the request
- [x] 2.3 On `onsessioninitialized(id)`: add transport to map; set `transport.onclose = () => map.delete(id)`
- [x] 2.4 On request with known `mcp-session-id`: route to existing transport

### 3. Validation
- [x] 3.1 `npm run build` — zero TypeScript errors
- [x] 3.2 `agent mcp list` succeeds twice in a row from groupDir (verifies per-session transport)
- [x] 3.3 Test A (stdio nanoclaw in workspace mcp.json): agent invokes `nanoclaw__send_message`
- [x] 3.4 Test B (HTTP proxy in workspace mcp.json): agent invokes `nanoclaw__send_message` via proxy
