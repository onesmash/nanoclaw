## MODIFIED Requirements

### Requirement: Workspace MCP Config Sync
`cursor-runner` SHALL merge the `nanoclaw` MCP server configuration into `{groupDir}/.cursor/mcp.json` before spawning `agent acp`, so that Cursor can reliably discover the MCP server via its native workspace config.

The `nanoclaw` entry SHALL NOT include an `env` field; all required environment variables (`NANOCLAW_CHAT_JID`, `NANOCLAW_IPC_DIR`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`) SHALL be passed via the inherited process environment of `agent acp`.

#### Scenario: mcp.json written without env block
- **WHEN** `syncMcpJson()` is called
- **THEN** the written `nanoclaw` entry contains only `command` and `args`, no `env` field

#### Scenario: MCP server receives correct JID via inherited env
- **GIVEN** `agent acp` is spawned with `NANOCLAW_CHAT_JID=fs:p_ou_...` in `spawnEnv`
- **WHEN** Cursor starts the `nanoclaw` MCP server subprocess from `mcp.json`
- **THEN** the MCP server inherits `NANOCLAW_CHAT_JID` from the parent process
- **AND** `schedule_task` creates tasks with the correct channel JID

#### Scenario: Existing mcp.json entries preserved
- **WHEN** `{groupDir}/.cursor/mcp.json` contains other MCP server entries
- **THEN** those entries are preserved and only `mcpServers.nanoclaw` is updated

#### Scenario: Write failure is non-fatal
- **WHEN** writing `mcp.json` fails (e.g., permissions error)
- **THEN** the error is logged and `cursor-runner` continues without aborting the agent session

#### Scenario: Multi-channel shared folder
- **GIVEN** two channels (e.g., Zoom DM and Feishu) are both registered to folder `main`
- **WHEN** both cursor-runner processes sync `mcp.json`
- **THEN** the written file is identical for both (no per-JID field), so no race condition exists
- **AND** each MCP server subprocess receives the correct `NANOCLAW_CHAT_JID` from its own inherited process environment
