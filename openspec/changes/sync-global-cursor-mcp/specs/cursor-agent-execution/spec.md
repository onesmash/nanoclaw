## MODIFIED Requirements

### Requirement: Workspace MCP Config Sync
`cursor-runner` SHALL merge the `nanoclaw` MCP server configuration into both `{groupDir}/.cursor/mcp.json` and `~/.cursor/mcp.json` before spawning `agent acp`, so that Cursor can reliably discover the MCP server via its native workspace and global configs.

The merge MUST:
- Only write the `mcpServers.nanoclaw` key; all other existing keys in each file SHALL be preserved
- Resolve all env values at runtime (no env var references in the written file)
- Create target directories if they do not exist
- Handle each target independently: a write failure on one target MUST NOT prevent writing the other

#### Scenario: Global file does not exist
- **WHEN** `~/.cursor/mcp.json` does not exist
- **THEN** the file is created with `{ "mcpServers": { "nanoclaw": { ... } } }`

#### Scenario: Global file exists with other servers
- **WHEN** `~/.cursor/mcp.json` contains other MCP server entries
- **THEN** those entries are preserved and only `mcpServers.nanoclaw` is added or updated

#### Scenario: Global write failure
- **WHEN** writing `~/.cursor/mcp.json` fails (e.g., permissions error)
- **THEN** the error is logged, `cursor-runner` continues, and the workspace-level write still proceeds

#### Scenario: Last session wins for global config
- **WHEN** multiple group sessions start in sequence
- **THEN** each session overwrites `mcpServers.nanoclaw` in `~/.cursor/mcp.json` with its own group-specific env vars
