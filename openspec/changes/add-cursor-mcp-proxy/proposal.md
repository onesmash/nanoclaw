# Change: Add MCP Proxy for cursor-runner (fastmcp aggregation)

## Why

Cursor ACP's `newSession({ mcpServers })` silently ignores `McpServerStdio` configs — it only connects to already-running HTTP endpoints. The current `syncMcpJson()` workaround writes per-group `.cursor/mcp.json` so Cursor can spawn MCP servers via its own workspace config, but this approach has two structural problems:

1. **Single server only**: `mcp.json` is today written by cursor-runner with only the `nanoclaw` entry. Other MCP servers defined in the group's `mcp.json` (e.g. `peekaboo`, `context7`) are never registered with ACP at session time.
2. **Lifecycle not owned**: Cursor spawns MCP servers from `mcp.json` at workspace load, not at ACP session creation. cursor-runner cannot control start/stop or guarantee they are alive when `newSession` is called.

The fix is to spawn a fastmcp HTTP proxy inside cursor-runner that reads the group's full `mcp.json`, starts all defined servers, aggregates their tools, and exposes a single HTTP endpoint that ACP can connect to via `McpServerHttp`.

## What Changes

- **New file** `container/agent-runner/src/mcp-proxy.ts`: Node.js proxy using `@modelcontextprotocol/sdk` (already a dependency). Reads an mcpServers config, connects to each server with the appropriate client transport, aggregates all tools under namespaced names, and exposes a single `StreamableHTTPServerTransport` on a given port.
  - `command`/`args`/`env` entries → `StdioClientTransport` (spawns child process)
  - `url` entries → `StreamableHTTPClientTransport` (connects to remote HTTP server)
- **`cursor-runner.ts`**:
  - Add `findFreePort()`, `resolveConfig()`, `spawnProxy()`, `waitForProxy()` helpers.
  - `main()` spawns proxy before `newSession`, kills it in `finally`.
  - Pass `[{ type: 'http', url: 'http://127.0.0.1:<port>' }]` to ACP instead of `McpServerStdio`.
  - **BREAKING (internal)**: Remove `syncMcpJson()`, `writeMcpJson()`, and the stdio variant of `buildMcpServers()`.
- **Supersedes** in-flight changes: `remove-global-cursor-mcp-sync` (syncMcpJson removed entirely) and `cursor-mcp-jid-via-env` task 4 (mcp.json no longer used at session time).

## Impact

- Affected specs: `cursor-agent-execution` (REMOVED: Workspace MCP Config Sync; ADDED: MCP Proxy Lifecycle, MCP Server Aggregation)
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts`
  - `container/agent-runner/src/mcp-proxy.ts` (new)
- New dependency: none — `@modelcontextprotocol/sdk` is already installed
- Risk: LOW — proxy runs on loopback only; proxy process is fully owned by cursor-runner lifecycle
