## REMOVED Requirements

### Requirement: Workspace MCP Config Sync
**Reason**: Replaced by MCP Proxy Lifecycle. Writing `mcp.json` at session time gave Cursor a static file it could spawn MCPs from, but cursor-runner had no lifecycle control and ACP never actually read that file. The proxy approach gives cursor-runner full ownership.
**Migration**: `syncMcpJson()` and `writeMcpJson()` are deleted. `{groupDir}/.cursor/mcp.json` is now the *source* read by cursor-runner, not a target it writes to.

## ADDED Requirements

### Requirement: MCP Proxy Lifecycle
`cursor-runner` SHALL spawn a local fastmcp HTTP proxy before creating the ACP session, keep it alive for the duration of the session, and kill it in the `finally` block.

The proxy process:
- MUST be started with a port obtained from the OS (port 0 bind) to avoid conflicts
- MUST receive a resolved config file path as an argument; the config file MUST be deleted after the proxy is killed
- MUST be killed (SIGTERM) unconditionally in the `finally` block, even on error

#### Scenario: Proxy starts successfully
- **WHEN** cursor-runner spawns `mcp-proxy.py <port> <tmpConfigPath>`
- **THEN** cursor-runner polls `http://127.0.0.1:<port>/` until it receives any HTTP response
- **AND** cursor-runner proceeds to call `connection.newSession` with the proxy URL

#### Scenario: Proxy fails to start within timeout
- **WHEN** the proxy does not respond within the configured timeout (default 10s)
- **THEN** cursor-runner logs the error, kills the proxy process, and exits with a `ContainerOutput` error

#### Scenario: Session ends normally
- **WHEN** the ACP session completes (close sentinel or error)
- **THEN** the proxy child process is killed and the temp config file is deleted

#### Scenario: Multiple concurrent sessions
- **WHEN** two cursor-runner processes run simultaneously for different groups
- **THEN** each spawns its own proxy on a distinct OS-assigned port with no conflict

### Requirement: MCP Server Aggregation
`cursor-runner` SHALL read the group's `.cursor/mcp.json`, resolve runtime env values into the `nanoclaw` entry, and pass the full config to the proxy so all defined MCP servers are available to the ACP session.

Tool names exposed to the agent MUST be namespaced by server name (e.g. `nanoclaw__send_message`, `peekaboo__screenshot`) to prevent collisions across servers.

If `{groupDir}/.cursor/mcp.json` does not exist, cursor-runner SHALL fall back to a nanoclaw-only default config constructed from runtime env vars.

#### Scenario: Group has multiple MCP servers
- **WHEN** `{groupDir}/.cursor/mcp.json` defines `nanoclaw` and `peekaboo`
- **THEN** the proxy exposes both servers' tools to the ACP agent
- **AND** tool names are prefixed: `nanoclaw__send_message`, `peekaboo__screenshot`

#### Scenario: nanoclaw env is injected at runtime
- **WHEN** `{groupDir}/.cursor/mcp.json` contains a `nanoclaw` entry with stale or missing env values
- **THEN** cursor-runner overwrites `NANOCLAW_IPC_DIR`, `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN` with the current session's values before passing the config to the proxy

#### Scenario: mcp.json absent
- **WHEN** `{groupDir}/.cursor/mcp.json` does not exist
- **THEN** cursor-runner uses a nanoclaw-only default config and logs a warning
- **AND** the session proceeds normally with only nanoclaw tools available

#### Scenario: Two channels share same group folder
- **GIVEN** two channels are registered to the same folder (e.g. `main`)
- **WHEN** two cursor-runner processes run concurrently
- **THEN** each resolves its own `chatJid` into the config independently (in-memory, not via a shared file)
- **AND** no race condition exists on `mcp.json`
