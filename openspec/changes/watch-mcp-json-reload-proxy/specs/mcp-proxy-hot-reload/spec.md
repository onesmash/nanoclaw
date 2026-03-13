## ADDED Requirements

### Requirement: File Watcher on mcp.json

`cursor-runner` SHALL attach a non-persistent `fs.watch` on `<groupDir>/.cursor/mcp.json` after the MCP proxy becomes ready. The watcher SHALL fire a reload handler when the file changes.

#### Scenario: Watcher registered after proxy ready

- **WHEN** the MCP proxy reports ready (`waitForProxy` resolves)
- **THEN** `cursor-runner` attaches `fs.watch` on `<groupDir>/.cursor/mcp.json` with `{ persistent: false }`

#### Scenario: File does not exist at watch time

- **WHEN** `mcp.json` does not exist when the watcher is attached
- **THEN** the watcher attachment MAY fail silently and the session continues normally (no crash)

### Requirement: Debounced Reload Trigger

The file-change callback in `cursor-runner` SHALL be debounced by 200ms to collapse multiple filesystem events from a single editor save into one reload action.

#### Scenario: Multiple rapid change events

- **WHEN** the filesystem emits 3 `change` events within 50ms (e.g., editor truncate-then-write pattern)
- **THEN** exactly one reload is triggered after the 200ms quiet period elapses

#### Scenario: Two saves separated by more than 200ms

- **WHEN** the user saves `mcp.json` at T=0 and again at T=500ms
- **THEN** two separate reload actions are triggered, one for each save

### Requirement: Config Rewrite Before Reload

Before posting `/reload` to the proxy, `cursor-runner` SHALL re-run `resolveConfig()` and overwrite `tmpConfigPath` with the new JSON. The `nanoclaw` entry in the result MUST always come from runtime `containerInput`, regardless of what is written in `mcp.json`.

#### Scenario: User adds a new MCP server

- **WHEN** the user adds `"my-server": { "command": "...", "args": [...] }` to `mcp.json`
- **THEN** `resolveConfig()` merges the new entry alongside the forced `nanoclaw` entry
- **AND** `tmpConfigPath` is overwritten with the merged config before POST /reload

#### Scenario: User edits the nanoclaw key in mcp.json

- **WHEN** the user writes a custom `nanoclaw` key in `mcp.json`
- **THEN** `resolveConfig()` overwrites it with the runtime `containerInput` values
- **AND** the proxy receives the authoritative nanoclaw config

### Requirement: POST /reload Endpoint

`mcp-proxy` SHALL expose a `POST /reload` HTTP endpoint on the same port as the main MCP endpoint. On receiving a request, the proxy SHALL re-read `configPath` from disk and perform a hot-swap of its upstream clients and server transport.

#### Scenario: Successful reload request

- **WHEN** `cursor-runner` sends `POST http://127.0.0.1:<port>/reload`
- **THEN** the proxy responds with HTTP 200
- **AND** the proxy has reconnected to the updated set of upstream servers

#### Scenario: Reload endpoint not called during normal operation

- **WHEN** `mcp.json` is never edited during a session
- **THEN** `POST /reload` is never called and proxy behavior is identical to the current implementation

### Requirement: Active Clients Tracking

`mcp-proxy` SHALL maintain an `activeClients: Map<string, Client>` keyed by server name. This map SHALL be used both for routing `callTool` requests and for diffing on reload.

#### Scenario: Initial connection

- **WHEN** `buildProxy` connects to servers at startup
- **THEN** each successfully connected client is stored in `activeClients` under its config key name

#### Scenario: Routing callTool via activeClients

- **WHEN** the Cursor agent calls a namespaced tool (e.g., `my-server__do_thing`)
- **THEN** the proxy looks up `activeClients.get("my-server")` and forwards the call

### Requirement: Hot-Swap on Reload

On `/reload`, `mcp-proxy` SHALL diff the old and new server name sets, close removed clients, connect new clients, rebuild `McpServer` + `StreamableHTTPServerTransport`, and swap the HTTP request handler atomically by removing all `request` listeners and adding a new one.

#### Scenario: Server added in mcp.json

- **WHEN** the new config contains a server name absent from `activeClients`
- **THEN** the proxy connects a new `Client` for that server and fetches its tools
- **AND** those tools appear in the aggregated tool list under the `<name>__<tool>` namespace

#### Scenario: Server removed from mcp.json

- **WHEN** the new config omits a server name present in `activeClients`
- **THEN** the proxy calls `client.close()` for that client and removes it from `activeClients`
- **AND** that server's tools are absent from the aggregated tool list after the swap

#### Scenario: Unchanged servers

- **WHEN** a server name exists in both old and new config
- **THEN** its existing `Client` connection is reused (not closed and reopened)

#### Scenario: Request handler swap

- **WHEN** the new `McpServer` + `StreamableHTTPServerTransport` pair is ready
- **THEN** the proxy calls `httpServer.removeAllListeners('request')` and attaches the new handler
- **AND** subsequent requests are served by the new transport

### Requirement: tools/list_changed Notification

After the hot-swap, `mcp-proxy` SHALL send `notifications/tools/list_changed` to notify connected Cursor agent sessions that the tool list has changed.

#### Scenario: Notification sent after successful reload

- **WHEN** the handler swap completes successfully
- **THEN** `notifications/tools/list_changed` is sent to all open MCP sessions
- **AND** the Cursor agent re-fetches the tool list and sees the updated tools

#### Scenario: No connected sessions at reload time

- **WHEN** `/reload` is called before any Cursor agent session has been initialized
- **THEN** no notification is sent (no sessions to notify) and the reload still succeeds

### Requirement: Watcher Cleanup in Finally Block

`cursor-runner` SHALL close the `fs.watch` watcher in its `finally` block, alongside the existing `agentProc.kill()` and `proxyProc.kill()` cleanup.

#### Scenario: Normal session end

- **WHEN** the close sentinel is received and the main loop exits cleanly
- **THEN** the watcher is closed before the process exits

#### Scenario: Error exit

- **WHEN** an unhandled error causes the `catch` block to fire and `process.exit(1)` is called
- **THEN** the `finally` block still runs and the watcher is closed before exit
