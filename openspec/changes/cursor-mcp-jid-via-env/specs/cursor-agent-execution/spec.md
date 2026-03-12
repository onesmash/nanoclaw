## MODIFIED Requirements

### Requirement: Workspace MCP Config Sync
`cursor-runner` SHALL merge the `nanoclaw` MCP server configuration into `{groupDir}/.cursor/mcp.json` before spawning `agent acp`, so that Cursor can reliably discover the MCP server via its native workspace config.

The merge MUST:
- Only write the `mcpServers.nanoclaw` key; all other existing keys in the file SHALL be preserved
- Resolve all env values at runtime (no env var references in the written file)
- Create `{groupDir}/.cursor/` directory if it does not exist
- NOT include `NANOCLAW_CHAT_JID` in the written `env` block; `NANOCLAW_CHAT_JID` SHALL instead be injected into the spawn environment of `agent acp` so the MCP server subprocess inherits it at runtime

#### Scenario: File does not exist
- **WHEN** `{groupDir}/.cursor/mcp.json` does not exist
- **THEN** the file is created with `{ "mcpServers": { "nanoclaw": { ... } } }` (without `NANOCLAW_CHAT_JID` in `env`)

#### Scenario: File exists with other servers
- **WHEN** `{groupDir}/.cursor/mcp.json` contains other MCP server entries
- **THEN** those entries are preserved and only `mcpServers.nanoclaw` is added or updated

#### Scenario: Write failure
- **WHEN** writing `mcp.json` fails (e.g., permissions error)
- **THEN** the error is logged and `cursor-runner` continues without aborting the agent session

#### Scenario: Two channels share same group folder
- **GIVEN** two channels (e.g., Zoom DM and Feishu) are both registered to folder `main`
- **WHEN** both cursor-runner processes sync `mcp.json`
- **THEN** the written file is identical for both (no per-JID field), so no race condition exists
- **AND** each MCP server subprocess receives the correct `NANOCLAW_CHAT_JID` from its own inherited process environment
