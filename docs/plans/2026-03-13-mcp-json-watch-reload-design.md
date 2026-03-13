# Design: mcp.json Watch + Hot-Reload MCP Proxy

**Date:** 2026-03-13
**Status:** Draft
**Risk:** LOW (contained within cursor-runner.ts and mcp-proxy.ts)

## Problem

`cursor-runner` reads `<groupDir>/.cursor/mcp.json` once at startup. If the user adds or removes MCP servers during an active session, the proxy won't pick them up — a full restart is required.

## Goal

Watch `groups/main/.cursor/mcp.json` for changes. When the file changes (between messages), reconfigure the MCP proxy without restarting cursor-runner or the proxy process.

## Approach

**cursor-runner** watches the file and calls a `/reload` HTTP endpoint on the proxy. The proxy rebuilds its `McpServer` + `StreamableHTTPServerTransport` and swaps the HTTP request handler — keeping the same port and process alive.

## Data Flow

```
[user edits mcp.json]
      │
      ▼
fs.watch fires (debounced 200ms)
      │
      ▼
cursor-runner: resolveConfig() → overwrite tmpConfigPath
      │
      ▼
POST http://127.0.0.1:<port>/reload
      │
      ▼
mcp-proxy /reload handler:
  1. Re-read tmpConfigPath
  2. Connect new upstream clients, close removed ones
  3. new McpServer + StreamableHTTPServerTransport
  4. Register all tools (existing + new)
  5. http.Server swaps request handler
  6. Send notifications/tools/list_changed
      │
      ▼
Cursor agent re-fetches tool list → new tools available
```

## cursor-runner.ts Changes

After the proxy is ready, set up a debounced `fs.watch` on `<groupDir>/.cursor/mcp.json`:

```typescript
const mcpJsonPath = path.join(groupDir, '.cursor', 'mcp.json');
const watcher = fs.watch(mcpJsonPath, { persistent: false }, debounce(200, async () => {
  const newConfig = resolveConfig(groupDir, containerInput, mcpServerPath);
  fs.writeFileSync(tmpConfigPath, JSON.stringify(newConfig));
  await fetch(`http://127.0.0.1:${port}/reload`, { method: 'POST' })
    .catch(e => log(`reload failed: ${e}`));
}));
// in finally: watcher.close()
```

`resolveConfig()` always overwrites the `nanoclaw` entry with runtime values from `containerInput` — so nanoclaw config is never affected by what's in `mcp.json`.

Debounce is needed because editors typically fire multiple change events per save.

## mcp-proxy.ts Changes

Track active upstream clients by name:

```typescript
const activeClients = new Map<string, Client>();
```

Add `/reload` POST endpoint to the HTTP server. On reload:

1. Re-read the config file
2. Diff current vs new server names
3. Close removed clients; connect new clients and fetch their tools
4. Build a new `McpServer` with all current tools (existing + new)
5. Build a new `StreamableHTTPServerTransport`
6. Swap the HTTP request handler: `httpServer.removeAllListeners('request'); httpServer.on('request', newTransport.handleRequest)`
7. Send `notifications/tools/list_changed` to notify the agent

No private SDK APIs are used — `McpServer` and `StreamableHTTPServerTransport` are reconstructed cleanly. In-flight requests during the swap are negligible since reload happens in the idle gap between messages.

## Constraints

- No process restarts (cursor-runner or proxy)
- Same port throughout the session
- `nanoclaw` entry always comes from runtime `containerInput`, not from `mcp.json`
- Debounce 200ms to handle editor multi-event saves
- Watcher closed in `finally` block alongside existing cleanup
