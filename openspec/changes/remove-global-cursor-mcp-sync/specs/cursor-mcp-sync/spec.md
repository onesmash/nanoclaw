## MODIFIED Requirements

### Requirement: Cursor MCP config sync scope

The cursor-runner MUST write the nanoclaw MCP server config only to the project-level workspace file (`{groupDir}/.cursor/mcp.json`). It MUST NOT write to the global user-level file (`~/.cursor/mcp.json`).

#### Scenario: Single target write

Given a cursor-runner session starts for group "mygroup" with `groupDir=/data/groups/mygroup`,
When `syncMcpJson` is called,
Then `{groupDir}/.cursor/mcp.json` is created or updated with the nanoclaw MCP entry,
And `~/.cursor/mcp.json` is NOT modified.

#### Scenario: Multiple concurrent groups

Given two groups "groupA" and "groupB" both trigger cursor-runner sessions,
When each session calls `syncMcpJson`,
Then each group's `.cursor/mcp.json` reflects its own env vars (JID, IPC dir),
And `~/.cursor/mcp.json` is not touched by either session.
