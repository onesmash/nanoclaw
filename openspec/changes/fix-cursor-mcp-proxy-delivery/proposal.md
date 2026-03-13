# Change: Fix MCP Proxy Delivery — Workspace mcp.json Instead of ACP mcpServers

## Why

During integration testing of `add-cursor-mcp-proxy`, two incorrect assumptions in the original design were discovered:

### 1. `newSession({ mcpServers })` is silently ignored

The `add-cursor-mcp-proxy` spec (task 3.1 and the "Proxy starts successfully" scenario) assumed the proxy URL could be delivered to the Cursor agent via `connection.newSession({ mcpServers: [{ type: 'http', url: ... }] })` or `connection.loadSession({ mcpServers: [...] })`.

**Actual behavior**: `agent acp` (version `2026.03.11-6dfa30c`) never connects to MCP servers passed through the ACP protocol. The field is silently ignored regardless of what is passed.

**Validated fix**: The agent reads `{cwd}/.cursor/mcp.json` at startup. Writing the proxy URL to this file **before** spawning `agent acp` is the only reliable mechanism.

### 2. `StreamableHTTPServerTransport` requires per-session instances

The original `mcp-proxy.ts` implementation used `sessionIdGenerator: undefined` (stateless mode). Cursor sends three requests in sequence per session (`POST /initialize`, `POST /notifications/initialized`, `GET /`); stateless mode rejects the second POST with HTTP 500.

Even switching to a single stateful transport instance fails for a second client (e.g. `agent mcp list` followed by the ACP session), because the transport marks itself initialised after the first connection.

**Validated fix**: Create a new `StreamableHTTPServerTransport` + `Server` pair per client connection, routing subsequent requests by the `mcp-session-id` header.

## What Changes

- **`cursor-runner.ts`**:
  - Write `{groupDir}/.cursor/mcp.json` with `{ mcpServers: { 'mcp-proxy': { url: 'http://127.0.0.1:<port>' } } }` **before** spawning `agent acp`, not passed via ACP protocol
  - Pass `mcpServers: []` to both `newSession` and `loadSession` (ACP field is unused)

- **`mcp-proxy.ts`**:
  - Replace stateless/single-instance transport with per-session transport map pattern: `Map<sessionId, StreamableHTTPServerTransport>`, creating a fresh transport+server pair for each new connection, routing by `mcp-session-id` header

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: MCP Proxy Lifecycle scenario; ADDED: MCP Proxy Per-Session Transport)
- Affected code: `container/agent-runner/src/cursor-runner.ts`, `container/agent-runner/src/mcp-proxy.ts`
- Supersedes: task 3.1 of `add-cursor-mcp-proxy` (which assumed ACP protocol delivery)
- Validation: both Test A (stdio nanoclaw directly in mcp.json) and Test B (HTTP proxy in mcp.json) confirmed working — agent responds with tool invocation result
