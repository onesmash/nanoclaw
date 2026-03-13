# Change: Sync nanoclaw MCP config to global ~/.cursor/mcp.json

## Why

`syncMcpJson` currently writes the nanoclaw MCP server config only to `{groupDir}/.cursor/mcp.json` (per-group workspace). When Cursor is opened outside the group workspace — or before any session starts — it cannot discover the nanoclaw MCP server.

Writing the same config to `~/.cursor/mcp.json` (Cursor's user-level global config) ensures nanoclaw is always available regardless of which workspace is open.

## What Changes

- `syncMcpJson` in `cursor-runner.ts` is extended to write the same nanoclaw entry to both:
  - `{groupDir}/.cursor/mcp.json` (existing)
  - `~/.cursor/mcp.json` (new)
- A `writeMcpJson(path, entry)` helper is extracted to avoid duplicating the merge-read-write logic
- Global config uses the same content as workspace config (last session wins for group-specific env vars)
- Per-path error handling: a failure on one target is logged but does not abort the other or the agent session

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: Workspace MCP Config Sync → also writes to global)
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — extract `writeMcpJson`, extend `syncMcpJson`, add `import os from 'os'`
- Depends on: `sync-cursor-workspace-mcp` (must be complete — provides the base `syncMcpJson` implementation)
