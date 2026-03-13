# Change: Watch mcp.json and hot-reload MCP proxy without restart

## Why

`cursor-runner` reads `<groupDir>/.cursor/mcp.json` once at startup. Adding or removing MCP servers during an active session requires a full process restart, breaking conversation continuity and forcing users to re-trigger their message.

## What Changes

- `cursor-runner.ts`: after the proxy is ready, attach a debounced `fs.watch` on `<groupDir>/.cursor/mcp.json`; on change, re-run `resolveConfig()`, overwrite `tmpConfigPath`, then POST `/reload` to the proxy. Close the watcher in the `finally` block.
- `mcp-proxy.ts`: track active upstream clients in `activeClients: Map<string, Client>`; add a `/reload` POST endpoint to the HTTP server; on reload, diff old vs new config, close removed clients, connect new ones, rebuild `McpServer` + `StreamableHTTPServerTransport`, swap the HTTP request handler, and send `notifications/tools/list_changed`.

## Impact

- Affected specs: `mcp-proxy-hot-reload` (new capability)
- Affected code: `container/agent-runner/src/cursor-runner.ts`, `container/agent-runner/src/mcp-proxy.ts`
- No breaking changes — the proxy port and process lifetime are unchanged
- `nanoclaw` entry always comes from runtime `containerInput`, never from `mcp.json`

## Change ID

`watch-mcp-json-reload-proxy`
