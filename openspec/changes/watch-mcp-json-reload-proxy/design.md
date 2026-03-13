# Design: mcp.json Watch + Hot-Reload MCP Proxy

## Context

`cursor-runner.ts` is the agent process lifecycle manager. It spawns `mcp-proxy.ts` as a child process before the agent starts, passes it a temporary config file, and tears both down in a `finally` block. Currently the proxy config is static for the lifetime of a session.

`mcp-proxy.ts` aggregates N upstream MCP servers (stdio or HTTP) behind a single `StreamableHTTP` endpoint. The Cursor agent connects to this proxy and discovers all tools at session initialization.

This change adds a live-reload path that requires coordination between the two files.

## Goals / Non-Goals

- Goals:
  - Allow users to add/remove MCP servers in `mcp.json` between messages without restarting the session
  - Propagate new tool lists to the Cursor agent via `notifications/tools/list_changed`
  - Keep the same port and process PIDs throughout
- Non-Goals:
  - Hot-reload while the agent is actively processing a prompt (reload happens in the idle gap)
  - Supporting mid-session changes to the `nanoclaw` entry (always sourced from runtime `containerInput`)
  - Supporting config file formats other than the existing `mcp.json` schema

## Decisions

### Decision: fs.watch in cursor-runner, /reload HTTP endpoint in proxy

cursor-runner already owns the config file path (`tmpConfigPath`) and already calls `resolveConfig()`. It is the natural place to detect file changes and re-run that logic. The proxy is a separate process so communication must cross a process boundary — the existing HTTP channel (same port) is the lowest-friction path.

Alternatives considered:
- Signal-based reload (SIGUSR1): not cross-platform, harder to test, no way to pass new config content
- Shared file re-read inside proxy: requires proxy to poll or watch independently, introduces a second watcher and a race with `resolveConfig()` overwriting the file

### Decision: Debounce 200ms in cursor-runner

Editors (VSCode, vim, etc.) commonly emit multiple `change` events per save (truncate + write, or multiple partial writes). A 200ms debounce collapses these into a single reload trigger. This is inline with the existing `PROXY_POLL_INTERVAL_MS = 200` constant already in the file.

### Decision: Rebuild McpServer + StreamableHTTPServerTransport on reload, swap http.Server handler

The MCP SDK does not expose a mutable tool registry on a live `Server` instance. The cleanest approach is to construct a new `Server` + `StreamableHTTPServerTransport` pair and atomically swap the HTTP request handler via `httpServer.removeAllListeners('request'); httpServer.on('request', newHandler)`. This avoids private SDK APIs and keeps the swap simple.

In-flight requests during the swap are negligible because reload is triggered between messages (cursor-runner fires POST /reload after the agent finishes a prompt turn and before the next one begins).

Alternatives considered:
- Mutating `allTools` array in place and keeping the same server: requires internal Server state to be refreshed, not part of the public API
- Full proxy process restart: would require cursor-runner to re-bind the port, re-write `.cursor/mcp.json`, and re-initialize the agent session

### Decision: activeClients Map<string, Client> for diffing

Tracking clients by name allows the reload handler to close only removed clients and connect only added ones, avoiding unnecessary reconnections. This also provides the routing map needed by `callTool`.

## Component: cursor-runner.ts

After `await waitForProxy(port)`, set up a watcher:

```
mcpJsonPath = <groupDir>/.cursor/mcp.json
watcher = fs.watch(mcpJsonPath, { persistent: false }, debounce(200ms, handler))

handler:
  newConfig = resolveConfig(groupDir, containerInput, mcpServerPath)
  fs.writeFileSync(tmpConfigPath, JSON.stringify(newConfig))
  fetch POST http://127.0.0.1:<port>/reload
    .catch(e => log(`reload failed: ${e}`))

finally:
  watcher.close()   // alongside agentProc.kill() and proxyProc.kill()
```

`resolveConfig()` always injects the `nanoclaw` entry from `containerInput` — edits to the `nanoclaw` key in `mcp.json` are silently overwritten.

## Component: mcp-proxy.ts

State added at module scope (inside `buildProxy`):

```
activeClients: Map<string, Client>   // name → connected Client
```

HTTP server gains a `/reload` route:

```
POST /reload
  body: ignored (config is re-read from configPath on disk)

handler:
  1. newConfig = JSON.parse(fs.readFileSync(configPath))
  2. oldNames = Set(activeClients.keys())
     newNames = Set(Object.keys(newConfig.mcpServers))
  3. for name in oldNames - newNames: activeClients.get(name).close(); activeClients.delete(name)
  4. for name in newNames - oldNames:
       client = new Client(...); await client.connect(buildClientTransport(...))
       tools = await client.listTools()
       push namespaced tools; activeClients.set(name, client)
  5. rebuild allTools from all activeClients
  6. newServer = new Server(...) with updated tools
  7. newTransport = new StreamableHTTPServerTransport(...)
     await newServer.connect(newTransport)
  8. httpServer.removeAllListeners('request')
     httpServer.on('request', newRequestHandler)   // uses newTransport + newServer
  9. send notifications/tools/list_changed to all open sessions
  10. res.writeHead(200); res.end()
```

## Risks / Trade-offs

- Handler swap race: if a request arrives between `removeAllListeners` and the new `on('request')`, it will receive a 404 or connection drop. This is acceptable given reloads happen in the idle gap between messages.
- Session transport map: existing `sessionTransports` entries reference the old transport. After swap, existing sessions will be re-initialized on their next request (the Cursor agent will reconnect automatically).
- File not found: if `mcp.json` is deleted, `resolveConfig()` falls back to nanoclaw-only and logs a warning — behavior is unchanged from startup.

## Migration Plan

No migration needed. This is an additive change. Sessions that never edit `mcp.json` during a run are unaffected.

## Open Questions

- Should reconnection errors for new clients (in the reload handler) be surfaced to the Cursor agent as a tool-level error, or silently logged? (Current proposal: log and skip the failing server, same as startup behavior.)
