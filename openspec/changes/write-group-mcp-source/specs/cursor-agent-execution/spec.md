## MODIFIED Requirements

### Requirement: MCP Server Aggregation
`cursor-runner` SHALL treat `{groupDir}/.cursor/mcp.json` as a read-only pre-proxy
source config containing user-defined MCP servers. cursor-runner MUST NOT write to this
file during a session.

`resolveConfig()` SHALL strip any `mcpServers` entry that has a `url` field but no
`command` field (URL-only proxy shims, not real stdio servers) before passing the config
to the proxy. Stripped entry names SHALL be logged.

The `nanoclaw` (ipc-mcp-stdio) entry is always added **internally** by `resolveConfig()`
with the current session's env values (`NANOCLAW_IPC_DIR`, `NANOCLAW_CHAT_JID`,
`NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`). It MUST NOT be stored in
`{groupDir}/.cursor/mcp.json`.

#### Scenario: Source file has stale proxy URL entry
- **GIVEN** `{groupDir}/.cursor/mcp.json` contains `mcp-proxy: { url: "http://127.0.0.1:<stale>" }`
- **WHEN** `resolveConfig()` reads the file
- **THEN** the `mcp-proxy` entry is removed from the in-memory config before passing to proxy
- **AND** a log line records the stripped entry name
- **AND** the on-disk file is NOT modified

#### Scenario: User-defined stdio servers preserved
- **GIVEN** `{groupDir}/.cursor/mcp.json` contains `peekaboo: { command: "...", args: [...] }`
- **WHEN** `resolveConfig()` reads the file
- **THEN** the `peekaboo` entry passes through to the proxy unchanged

#### Scenario: Nanoclaw entry added in-memory only
- **WHEN** `resolveConfig()` builds the proxy config
- **THEN** `mcpServers.nanoclaw` is present in the config passed to the proxy with
  `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN` set from `containerInput`
- **AND** `{groupDir}/.cursor/mcp.json` on disk does NOT contain a `nanoclaw` entry

#### Scenario: Empty source file
- **WHEN** `{groupDir}/.cursor/mcp.json` is `{"mcpServers":{}}` or does not exist
- **THEN** `resolveConfig()` returns a config with only the in-memory `nanoclaw` entry
- **AND** the session proceeds normally
