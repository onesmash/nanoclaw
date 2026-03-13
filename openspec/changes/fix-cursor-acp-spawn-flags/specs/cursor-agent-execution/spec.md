## MODIFIED Requirements

### Requirement: ACP Spawn Flags
`cursor-runner` SHALL spawn `agent acp` with flags `--workspace <groupDir> --approve-mcps --force --trust` to ensure the correct workspace is used, MCP servers are auto-approved, and tool calls are auto-approved without interactive prompts.

#### Scenario: Correct workspace
- **WHEN** `cursor-runner` spawns `agent acp`
- **THEN** `--workspace <groupDir>` is passed, so Cursor resolves rules/skills/AGENTS.md from the group directory

#### Scenario: MCP auto-approval
- **WHEN** `cursor-runner` spawns `agent acp` with `--approve-mcps`
- **THEN** `cursor agent mcp list` shows `nanoclaw: ready` without requiring manual `cursor agent mcp enable nanoclaw`

#### Scenario: Tool auto-approval
- **WHEN** `cursor-runner` spawns `agent acp` with `--force`
- **THEN** tool calls (file reads, shell commands, MCP tool calls) are executed without triggering `session/request_permission` callbacks that would block headless operation

### Requirement: MCP Server Command Path
The `command` field in both the `mcp.json` nanoclaw entry (written by `syncMcpJson`) and the ACP session `mcpServers` list (built by `buildMcpServers`) SHALL use `process.execPath` instead of the literal string `'node'`, so the MCP server subprocess uses the same Node.js binary as the runner process regardless of `PATH` configuration.

#### Scenario: Custom Node installation
- **GIVEN** Node.js is installed at a non-standard path not on `PATH`
- **WHEN** `cursor-runner` writes `mcp.json` or passes `mcpServers` to ACP
- **THEN** `command` resolves to the same binary currently running, and Cursor can start the MCP server without a `node: not found` error
