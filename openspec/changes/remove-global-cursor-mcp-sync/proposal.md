# Change: Remove global ~/.cursor/mcp.json sync from cursor-runner

## Why

`syncMcpJson` currently writes the nanoclaw MCP config to two targets:
1. `{groupDir}/.cursor/mcp.json` — per-group directory config
2. `~/.cursor/mcp.json` — global user-level config

The global sync was added so Cursor could discover the nanoclaw MCP even when opened outside the group workspace. However, syncing to the global config causes problems:

- **Last-session-wins clobbering**: Every cursor-runner invocation overwrites `~/.cursor/mcp.json` with the env vars (JID, group folder, IPC dir) of whichever group ran most recently. When multiple groups exist, the global config becomes stale immediately after any other group triggers a session.
- **Cross-session pollution**: A Cursor window opened in an unrelated workspace silently picks up nanoclaw MCP pointing at a different group's IPC socket.
- **Unintended side effects**: Modifying a global config file on every agent invocation is a side effect that exceeds the scope of a per-group session.

The `~/.cursor/mcp.json` global target is wrong — replacing it with `{PROJECT_ROOT}/.cursor/mcp.json` (the nanoclaw-zoom git root) gives Cursor a workspace-scoped config that is stable across all group sessions and doesn't pollute unrelated workspaces.

The `{groupDir}/.cursor/mcp.json` target is retained so that Cursor opened directly inside a group folder also picks up the correct config.

## What Changes

- In `src/process-runner.ts`: add `NANOCLAW_PROJECT_ROOT: process.cwd()` to the env vars passed to the subprocess (alongside existing `NANOCLAW_GROUP_DIR`, `NANOCLAW_IPC_DIR`, etc.).
- In `container/agent-runner/src/cursor-runner.ts`:
  - Replace `path.join(os.homedir(), '.cursor', 'mcp.json')` in the `targets` array with `path.join(process.env.NANOCLAW_PROJECT_ROOT ?? '', '.cursor', 'mcp.json')`.
  - The `{groupDir}` target is kept unchanged.
  - The `import os from 'os'` import is removed (no longer used).

## Impact

- Affected files:
  - `src/process-runner.ts` — add `NANOCLAW_PROJECT_ROOT` env var
  - `container/agent-runner/src/cursor-runner.ts` — replace `os.homedir()` target with project-root target, remove `os` import
- Depends on: `sync-global-cursor-mcp` (this change replaces the global-sync target introduced by that change)
- No spec changes required: the workspace MCP sync spec remains unchanged; the fix is purely about which directory receives the config file.
