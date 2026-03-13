## MODIFIED Requirements

### Requirement: MCP Server Aggregation
`cursor-runner` SHALL maintain `{groupDir}/.cursor/mcp.json` as the **pre-proxy source
config** by writing the `nanoclaw` MCP server entry (with NANOCLAW_IPC_DIR,
NANOCLAW_CHAT_JID, NANOCLAW_GROUP_FOLDER, NANOCLAW_IS_MAIN in the `env` block) to that
file at the start of every session, and removing any stale proxy URL entries
(`http://127.0.0.1:*`) that may have been written by earlier implementations.

After this write, `resolveConfig()` reads the updated file and still overrides the
nanoclaw env block with fresh values from `containerInput` before passing the config to
the proxy. The on-disk file reflects the last-session values; the in-memory config used
for proxying is always current.

The two-file invariant:
- `{groupDir}/.cursor/mcp.json` — pre-proxy source; written by `syncGroupSourceMcpJson()`
- `{projectRoot}/.cursor/mcp.json` — runtime proxy endpoint; written with proxy URL

Write failure in `syncGroupSourceMcpJson()` MUST be non-fatal: log the error and continue
so the proxy session proceeds normally.

#### Scenario: Group source file written with nanoclaw entry and env vars
- **WHEN** cursor-runner starts a session for a group
- **THEN** `{groupDir}/.cursor/mcp.json` contains `mcpServers.nanoclaw` with `command`,
  `args`, and `env` including `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`,
  `NANOCLAW_IS_MAIN`, and `NANOCLAW_IPC_DIR`
- **AND** `resolveConfig()` then reads this file and overrides the nanoclaw env with
  the current session's values before passing to the proxy

#### Scenario: Stale mcp-proxy URL entry is removed
- **GIVEN** `{groupDir}/.cursor/mcp.json` contains `mcpServers.mcp-proxy` with a
  `url: "http://127.0.0.1:<port>"` entry from a previous implementation
- **WHEN** cursor-runner calls `syncGroupSourceMcpJson()`
- **THEN** the `mcp-proxy` entry is deleted from the file
- **AND** the proxy does not attempt to connect to a stale or dead loopback URL

#### Scenario: User-defined MCP servers preserved
- **GIVEN** `{groupDir}/.cursor/mcp.json` contains user-defined servers (e.g., `peekaboo`)
- **WHEN** `syncGroupSourceMcpJson()` runs
- **THEN** the user-defined entries are preserved unchanged
- **AND** only the `nanoclaw` entry is upserted and stale proxy entries are removed

#### Scenario: Write failure is non-fatal
- **WHEN** `syncGroupSourceMcpJson()` fails to write (e.g., permission error)
- **THEN** the error is logged and cursor-runner proceeds with `resolveConfig()` normally
- **AND** the proxy session starts and nanoclaw env is still injected correctly in memory

#### Scenario: Two channels sharing same group folder
- **GIVEN** two channels (e.g., Zoom DM and Feishu) are registered to the same folder
- **WHEN** they run sequentially (GroupQueue serialises within a folder)
- **THEN** each session writes its own `NANOCLAW_CHAT_JID` to the file (last-writer wins)
- **AND** `resolveConfig()` always overrides with the current session's JID, so no
  misrouting occurs regardless of the on-disk value
