> ⚠️ **Partially superseded by `fix-cursor-mcp-workspace-root`**: `preApproveMcps` must
> be called with `cwd: projectRoot` (git root), not `cwd: groupDir`. Running from `groupDir`
> inside a git repo stores approvals in the wrong workspace slug. See
> `fix-cursor-mcp-workspace-root` for the corrected cwd.

## MODIFIED Requirements

### Requirement: Auto-Approve MCP After Config Sync
After `syncMcpJson()` writes MCP configs, `cursor-runner` SHALL synchronously query `agent mcp list` from `groupDir`, identify all MCPs with status `needs approval`, and call `agent mcp enable <name>` for each before starting the ACP session.

The pre-approve step MUST:
- Run blocking (synchronous) so all approvals complete before `agent acp` is spawned
- Cover all MCPs that need approval, not just nanoclaw
- Ignore per-MCP enable failures silently (ACP session proceeds regardless)
- Use `agent` binary directly (not `cursor agent` wrapper) consistent with ACP spawn

#### Scenario: One or more MCPs need approval
- **GIVEN** `agent mcp list` from `groupDir` reports one or more MCPs as `not loaded (needs approval)`
- **WHEN** cursor-runner starts a new session
- **THEN** `preApproveMcps(groupDir)` runs before `spawn('agent', ['acp', ...])`
- **AND** each unapproved MCP is enabled via `agent mcp enable <name>`
- **AND** `agent mcp list` shows all MCPs as `ready` once ACP starts

#### Scenario: All MCPs already approved
- **GIVEN** `agent mcp list` reports no MCPs as `needs approval`
- **WHEN** cursor-runner starts a new session
- **THEN** `preApproveMcps` logs "All MCPs already approved" and returns immediately
- **AND** no `agent mcp enable` calls are made

#### Scenario: Enable fails for one MCP
- **GIVEN** `agent mcp enable <name>` exits with an error for a specific MCP
- **WHEN** `preApproveMcps` processes that MCP
- **THEN** the error is silently ignored
- **AND** remaining MCPs are still processed
- **AND** ACP session starts normally (falling back to `--approve-mcps`)
