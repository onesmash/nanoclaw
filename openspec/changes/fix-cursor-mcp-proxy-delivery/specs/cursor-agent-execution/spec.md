> ⚠️ **Superseded by `fix-cursor-mcp-workspace-root`**: The `{groupDir}/.cursor/mcp.json`
> path below is incorrect — the agent uses the git root as its workspace and ignores
> subdirectory files. The `waitForProxy` ordering is also wrong (was after agent spawn).
> See `fix-cursor-mcp-workspace-root/specs/cursor-agent-execution/spec.md` for the correct spec.

## MODIFIED Requirements

### Requirement: MCP Proxy Lifecycle
`cursor-runner` SHALL deliver the proxy URL by writing `{groupDir}/.cursor/mcp.json` before spawning `agent acp`. The ACP `newSession({ mcpServers })` field MUST NOT be used for MCP delivery — it is silently ignored by the agent. The agent reads this file at startup based on its working directory; it never connects to MCP servers supplied through the ACP protocol.

The updated lifecycle is:
1. `findFreePort()` — OS-assigned TCP port
2. `resolveConfig()` — read group mcp.json, inject runtime env
3. Write resolved config to temp file
4. `spawnProxy(port, configPath)` — spawn `mcp-proxy.js` child process
5. `waitForProxy(port)` — poll until any HTTP response
6. Write `{groupDir}/.cursor/mcp.json` with `{ "mcpServers": { "mcp-proxy": { "url": "http://127.0.0.1:<port>" } } }`
7. `preApproveMcps(groupDir)` — run `agent mcp enable` for any unapproved entries
8. Spawn `agent acp` (cwd = groupDir)
9. ACP `initialize` + `newSession({ cwd: groupDir, mcpServers: [] })`

The `mcpServers: []` in step 9 is intentional — the value is unused by the agent.

#### Scenario: Proxy URL delivered via workspace file
- **WHEN** cursor-runner has written `{groupDir}/.cursor/mcp.json` containing the proxy URL
- **AND** cursor-runner spawns `agent acp` with `cwd = groupDir`
- **THEN** the agent connects to the proxy at startup and exposes its tools in the ACP session

#### Scenario: ACP mcpServers field is not used
- **WHEN** cursor-runner calls `connection.newSession({ cwd: groupDir, mcpServers: [] })`
- **THEN** the agent does not attempt to connect to any MCP server via the ACP protocol
- **AND** MCP connectivity is established solely through `{groupDir}/.cursor/mcp.json`

#### Scenario: Proxy fails to start within timeout
- **WHEN** the proxy does not respond within the configured timeout (default 10s)
- **THEN** cursor-runner logs the error, kills the proxy process, and exits with a `ContainerOutput` error

#### Scenario: Session ends normally
- **WHEN** the ACP session completes (close sentinel or error)
- **THEN** the proxy child process is killed and the temp config file is deleted

#### Scenario: Multiple concurrent sessions
- **WHEN** two cursor-runner processes run simultaneously for different groups
- **THEN** each spawns its own proxy on a distinct OS-assigned port, writes its own `{groupDir}/.cursor/mcp.json`, with no conflict

## ADDED Requirements

### Requirement: MCP Proxy Per-Session Transport
`mcp-proxy` SHALL create a new `StreamableHTTPServerTransport` and `Server` instance for each new client connection, routing subsequent requests by the `mcp-session-id` HTTP header.

A single stateful transport instance MUST NOT be shared across clients. Stateless mode (`sessionIdGenerator: undefined`) MUST NOT be used. Both patterns fail because the Cursor agent sends `POST /initialize`, `POST /notifications/initialized`, and `GET /` in sequence per session.

The per-session transport map:
- Key: session ID string (from `mcp-session-id` header or `onsessioninitialized` callback)
- Value: `StreamableHTTPServerTransport` instance
- Cleanup: `transport.onclose` deletes the entry to prevent memory leaks

#### Scenario: First connection initialises correctly
- **WHEN** a client sends `POST /` with method `initialize` (no `mcp-session-id` header)
- **THEN** the proxy creates a new transport with `sessionIdGenerator: () => randomUUID()`
- **AND** returns HTTP 200 with an SSE stream containing the session ID in the `mcp-session-id` response header

#### Scenario: Subsequent requests in same session reuse transport
- **WHEN** a client sends `POST /` with `mcp-session-id: <id>` matching an existing entry
- **THEN** the proxy routes the request to the existing transport instance without creating a new one

#### Scenario: Second client connects while first is active
- **WHEN** `agent mcp list` connects and then the ACP session connects immediately after
- **THEN** each receives its own transport+server pair
- **AND** neither session interferes with the other

#### Scenario: Session closes and transport is cleaned up
- **WHEN** a client disconnects or the transport fires `onclose`
- **THEN** the session ID is removed from the transport map
- **AND** no memory leak occurs for long-running cursor-runner processes handling many sequential messages
