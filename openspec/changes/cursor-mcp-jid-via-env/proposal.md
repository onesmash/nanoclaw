# Change: Remove NANOCLAW_CHAT_JID from mcp.json, Pass via Spawn Env

## Why

`syncMcpJson()` in `cursor-runner.ts` writes `NANOCLAW_CHAT_JID` as a static resolved value into `{groupDir}/.cursor/mcp.json`. When two channels share the same group folder (e.g., `zoom:dm:...` and `fs:p_...` both registered to folder `main`), two concurrent cursor-runner processes race to overwrite `mcp.json`. Whichever writes last wins — the MCP server started by Cursor from `mcp.json` gets the wrong `chatJid` for the other channel, causing misrouted `send_message` calls.

**Root cause:** `mcp.json` is a shared file on disk; it cannot simultaneously hold per-JID state for two channels sharing the same folder.

**ACP path is already correct:** `buildMcpServers()` passes `NANOCLAW_CHAT_JID` dynamically via ACP `newSession`/`loadSession` env — those sessions are already isolated per run. Only the `mcp.json` fallback path is broken.

## What Changes

1. `syncMcpJson()` no longer writes `NANOCLAW_CHAT_JID` into `mcp.json`'s `env` block — other four env vars (`NANOCLAW_IPC_DIR`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`, and the MCP server path) remain.
2. `cursor-runner.ts` adds `NANOCLAW_CHAT_JID: containerInput.chatJid` to `spawnEnv` before spawning `agent acp`. The `agent acp` process (and its MCP server child process started from `mcp.json`) inherits this env var, so `ipc-mcp-stdio.js` still reads the correct value.

No changes to `buildMcpServers()`, `ipc-mcp-stdio.ts`, `shared.ts`, `claude-runner.ts`, or any spec other than `cursor-agent-execution`.

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: Workspace MCP Config Sync requirement)
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — two small edits (remove key from `syncMcpJson`, add key to `spawnEnv`)
- Depends on: `sync-cursor-workspace-mcp` (already deployed — adds `syncMcpJson`)
- Risk: LOW — behaviour-equivalent for single-channel setups; fixes race for shared-folder multi-channel setups
