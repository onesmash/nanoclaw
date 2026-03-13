## ADDED Requirements

### Requirement: Auto-Approve nanoclaw MCP After Config Sync
After `syncMcpJson()` writes the nanoclaw MCP config to `mcp.json` files, `cursor-runner` SHALL spawn `cursor agent mcp enable nanoclaw` as a detached background process (fire-and-forget) to register the current config hash in `mcp-approvals.json`.

The background spawn MUST:
- Run detached with `stdio: 'ignore'` and call `.unref()` so it does not block cursor-runner from proceeding
- Inherit the cursor-runner process CWD (nanoclaw-zoom project root) so the approval is written to the correct project-level `mcp-approvals.json`
- Not affect the current ACP session startup (which already uses `--approve-mcps`)

#### Scenario: Hash changed after node upgrade
- **GIVEN** node was upgraded from `25.6.1_1` to `26.0.0_1`, changing `process.execPath` and therefore the config hash
- **WHEN** a new cursor-runner session starts and calls `syncMcpJson()`
- **THEN** `cursor agent mcp enable nanoclaw` runs in the background
- **AND** within ~3 seconds, `cursor agent mcp list` shows `nanoclaw: ready`
- **AND** the Cursor IDE shows nanoclaw MCP as active without manual user action

#### Scenario: Hash unchanged (already approved)
- **GIVEN** nanoclaw config has not changed since last session
- **WHEN** a new cursor-runner session starts and the background `enable` runs
- **THEN** `cursor agent mcp enable nanoclaw` exits immediately with "already enabled and approved"
- **AND** `mcp-approvals.json` is unchanged
- **AND** no duplicate entries are added

#### Scenario: Background command fails
- **GIVEN** the `cursor` binary is not on PATH or exits with an error
- **WHEN** the background spawn fails
- **THEN** cursor-runner continues normally (the ACP session uses `--approve-mcps` and is unaffected)
- **AND** the failure is silent (fire-and-forget — no error surfaced to the user)
