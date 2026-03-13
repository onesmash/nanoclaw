## MODIFIED Requirements

### Requirement: MCP Proxy Lifecycle
`cursor-runner` SHALL deliver the proxy URL by writing `{projectRoot}/.cursor/mcp.json`
before spawning `agent acp`, where `projectRoot` is the nanoclaw-zoom git root
(`$NANOCLAW_PROJECT_ROOT` env var). Writing to `{groupDir}/.cursor/mcp.json` MUST NOT
be used — the `agent` CLI walks up the directory tree to the git root and silently ignores
workspace files in subdirectories.

The `--workspace groupDir` flag on `agent acp` controls where the agent reads/writes files
(keeping its working context in `groupDir`) but does NOT affect which `.cursor/mcp.json` is
read for MCP configuration.

The correct lifecycle is:
1. `findFreePort()` — OS-assigned TCP port
2. `resolveConfig()` — read group mcp.json, inject runtime env
3. Write resolved config to temp file
4. `spawnProxy(port, configPath)` — spawn `mcp-proxy.js` child process
5. `waitForProxy(port)` — poll until any HTTP response ← MUST complete before step 6
6. Write `{projectRoot}/.cursor/mcp.json` with `{ "mcpServers": { "mcp-proxy": { "url": "http://127.0.0.1:<port>" } } }`
7. `preApproveMcps(projectRoot)` — run `agent mcp enable` from `projectRoot` for any unapproved entries
8. Spawn `agent acp --workspace groupDir` (cwd = groupDir)
9. ACP `initialize` + `newSession({ cwd: groupDir, mcpServers: [] })`

The ordering of steps 5-7 is critical:
- `waitForProxy` before writing `mcp.json`: the agent connects to the proxy at startup;
  a proxy that isn't listening yet causes a silent connection failure for the entire session.
- Write `mcp.json` before `preApproveMcps`: the approval hash is derived from the URL
  including the port; approving before writing gives a stale hash.

#### Scenario: Proxy URL delivered via workspace file at project root
- **WHEN** cursor-runner has written `{projectRoot}/.cursor/mcp.json` containing the proxy URL
- **AND** the proxy is confirmed ready (`waitForProxy` returned) before the file was written
- **AND** cursor-runner spawns `agent acp` with `--workspace groupDir`, `cwd = groupDir`
- **THEN** the agent detects `projectRoot` as its workspace (git root detection)
- **AND** connects to the proxy at startup and exposes its tools in the ACP session

#### Scenario: Agent ignores groupDir mcp.json
- **WHEN** `{groupDir}/.cursor/mcp.json` exists but `{projectRoot}/.cursor/mcp.json` does not
- **THEN** the agent does not load the MCP server
- **AND** `agent mcp list` run from `groupDir` only shows user-level MCPs

#### Scenario: preApproveMcps runs from projectRoot
- **WHEN** `preApproveMcps(projectRoot)` is called
- **AND** the `.cursor/mcp.json` has already been written to `projectRoot`
- **THEN** approvals are stored in `~/.cursor/projects/<projectRoot-slug>/mcp-approvals.json`
- **AND** `agent mcp list` from `projectRoot` shows `mcp-proxy: ready`

#### Scenario: Multiple concurrent sessions
- **WHEN** two cursor-runner processes run simultaneously for different groups
- **THEN** each spawns its own proxy on a distinct OS-assigned port
- **AND** each writes its proxy URL to `{projectRoot}/.cursor/mcp.json` (shared location)
- **NOTE** concurrent writes are a known limitation; acceptable because nanoclaw processes
  one session at a time per group and the write window is small
