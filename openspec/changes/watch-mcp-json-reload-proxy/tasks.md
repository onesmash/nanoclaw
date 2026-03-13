## 1. cursor-runner.ts: debounce utility

- [x] 1.1 Add an inline `debounce(ms, fn)` helper (or import one) in `cursor-runner.ts` — no external dependency needed; a simple `setTimeout`/`clearTimeout` closure is sufficient

## 2. cursor-runner.ts: attach fs.watch

- [x] 2.1 After `await waitForProxy(port)`, compute `mcpJsonPath = path.join(groupDir, '.cursor', 'mcp.json')`
- [x] 2.2 Call `fs.watch(mcpJsonPath, { persistent: false }, debounce(200, handler))` and store the watcher reference

## 3. cursor-runner.ts: POST /reload on change

- [x] 3.1 In the debounced handler, call `resolveConfig(groupDir, containerInput, mcpServerPath)` and overwrite `tmpConfigPath` with `JSON.stringify(newConfig)`
- [x] 3.2 POST `http://127.0.0.1:${port}/reload` and `.catch(e => log(...))`on failure

## 4. cursor-runner.ts: watcher cleanup in finally

- [x] 4.1 In the `finally` block, call `watcher.close()` alongside `agentProc.kill()` and `proxyProc.kill()`

## 5. mcp-proxy.ts: activeClients tracking

- [x] 5.1 Replace the local `clients` Map inside `buildProxy` with a module-level (or closure-level) `activeClients: Map<string, Client>` so the reload handler can access it
- [x] 5.2 Populate `activeClients` during initial connect loop (same as current `clients` logic)
- [x] 5.3 Update `callTool` routing to use `activeClients` instead of `clients`

## 6. mcp-proxy.ts: /reload endpoint on HTTP server

- [x] 6.1 Add a branch in the `http.createServer` request handler (or a separate `request` listener) for `req.method === 'POST' && req.url === '/reload'`
- [x] 6.2 Read and parse the updated config from `configPath` on disk
- [x] 6.3 Compute `oldNames` and `newNames` sets; close clients for removed names; connect clients for added names (reusing `buildClientTransport`)
- [x] 6.4 Rebuild `allTools` from all current `activeClients`
- [x] 6.5 Respond HTTP 200 (or 500 on error) and log the outcome

## 7. mcp-proxy.ts: handler swap logic

- [x] 7.1 Construct new `Server` + `StreamableHTTPServerTransport` using the updated `allTools`
- [x] 7.2 Call `httpServer.removeAllListeners('request')` and attach the new request handler that delegates to the new transport
- [x] 7.3 Preserve the existing `sessionTransports` map (new sessions will use the new handler; existing sessions are expired)

## 8. mcp-proxy.ts: send notifications/tools/list_changed

- [x] 8.1 After the handler swap, iterate open sessions in `sessionTransports` and send `notifications/tools/list_changed` via the new transport
- [x] 8.2 Handle the case where there are no open sessions (no-op, no error)

## 9. Manual integration test

- [ ] 9.1 Start a session, note the initial tool list
- [ ] 9.2 Edit `groups/main/.cursor/mcp.json` to add a new MCP server entry
- [ ] 9.3 Wait 200ms; verify `[cursor-runner] proxy: [mcp-proxy] reload ...` log line appears
- [ ] 9.4 Send a new message in the session; confirm the new server's tools are available to the agent
- [ ] 9.5 Remove the server entry from `mcp.json`; send another message; confirm the tools are gone
