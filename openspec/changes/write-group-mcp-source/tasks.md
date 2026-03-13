## Tasks

- [ ] 1. Add `syncGroupSourceMcpJson(groupDir, containerInput, mcpServerPath)` to `container/agent-runner/src/cursor-runner.ts`:
  - Read `{groupDir}/.cursor/mcp.json` (catch and default to `{ mcpServers: {} }` on missing/invalid)
  - Remove any `mcpServers` entries whose value contains `url` starting with `http://127.0.0.1` (stale proxy entries)
  - Upsert `mcpServers.nanoclaw` with `{ command: process.execPath, args: [mcpServerPath], env: { NANOCLAW_IPC_DIR, NANOCLAW_CHAT_JID, NANOCLAW_GROUP_FOLDER, NANOCLAW_IS_MAIN } }`
  - `fs.mkdirSync(path.join(groupDir, '.cursor'), { recursive: true })`
  - Write result back to `{groupDir}/.cursor/mcp.json` with `JSON.stringify(..., null, 2)`
  - Wrap in try/catch: log failure and continue (non-fatal)
- [ ] 2. In `main()`, call `syncGroupSourceMcpJson(groupDir, containerInput, mcpServerPath)` immediately after `syncAgentsMd()` and before `resolveConfig()`
- [ ] 3. Run `npm run build` inside `container/agent-runner/` and confirm zero TypeScript errors
- [ ] 4. Manually verify: send a message, then inspect `groups/main/.cursor/mcp.json` — confirm it contains `nanoclaw` entry with `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`, and no `mcp-proxy` URL entry
