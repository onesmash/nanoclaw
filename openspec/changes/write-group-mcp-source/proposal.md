# Change: Write Nanoclaw Entry to Group Source mcp.json, Clean Stale Proxy Entries

## Why

`groups/{name}/.cursor/mcp.json` is currently the *source* file cursor-runner reads to get
the user's custom MCP servers for proxying. However:

1. **File may contain stale proxy URL entries** (`mcp-proxy: { url: ... }`) left over from
   earlier implementations (`fix-cursor-mcp-proxy-delivery` wrote the proxy URL to
   `{groupDir}/.cursor/mcp.json` before `fix-cursor-mcp-workspace-root` changed it to
   `{projectRoot}/.cursor/mcp.json`). These stale entries cause `resolveConfig()` to pass a
   dead URL to the proxy, which fails silently.

2. **Nanoclaw entry is invisible** — cursor-runner injects the `nanoclaw` MCP server config
   in-memory inside `resolveConfig()` but never persists it to
   `{groupDir}/.cursor/mcp.json`. Users and operators cannot inspect or verify which env
   vars (`NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`) the nanoclaw
   MCP server is configured with for a given group.

3. **IPC MCP env vars not in source file** — `ipc-mcp-stdio` needs `NANOCLAW_CHAT_JID`,
   `NANOCLAW_GROUP_FOLDER`, and `NANOCLAW_IS_MAIN` to route correctly. These are injected
   in-memory but absent from the on-disk file, making it impossible to verify group config
   without reading cursor-runner source code.

**Fix**: Before `resolveConfig()` reads `{groupDir}/.cursor/mcp.json`, call a new
`syncGroupSourceMcpJson()` that writes the nanoclaw entry (with NANOCLAW_CHAT_JID,
NANOCLAW_GROUP_FOLDER, NANOCLAW_IS_MAIN) to the file and strips any stale `mcp-proxy`
URL entries. After this, `{groupDir}/.cursor/mcp.json` becomes the authoritative
pre-proxy source config, while `{projectRoot}/.cursor/mcp.json` remains the runtime
proxy endpoint (unchanged behavior).

## What Changes

- **`container/agent-runner/src/cursor-runner.ts`**:
  - Add `syncGroupSourceMcpJson(groupDir, containerInput, mcpServerPath)` that:
    - Reads existing `{groupDir}/.cursor/mcp.json` (tolerates absence)
    - Deletes any key whose value has `url` matching `http://127.0.0.1:*` pattern
      (stale proxy entries)
    - Upserts `mcpServers.nanoclaw` with `command`, `args`, and `env` containing
      `NANOCLAW_IPC_DIR`, `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`
    - Writes the result back to `{groupDir}/.cursor/mcp.json`
    - Logs and continues on write failure (non-fatal, same pattern as `syncAgentsMd`)
  - Call `syncGroupSourceMcpJson()` in `main()` **before** `resolveConfig()`.

No changes to `resolveConfig()`, the proxy spawn, `preApproveMcps()`, or the project-root
mcp.json write.

## Two-File Invariant After This Change

| File | Role | Written by | Contains |
|------|------|-----------|----------|
| `groups/{name}/.cursor/mcp.json` | Pre-proxy source config | `cursor-runner` (per session) | `nanoclaw` entry with env vars + user-defined servers |
| `.cursor/mcp.json` (project root) | Runtime proxy endpoint | `cursor-runner` (per session) | `mcp-proxy: { url: "http://127.0.0.1:<port>" }` |

## Race-Condition Analysis

`GroupQueue` serialises messages within a `group_folder`. Two channels that share
`folder=main` (e.g., Zoom DM + Feishu) cannot have concurrent cursor-runner processes for
the same folder, so there is no write-write race on `groups/main/.cursor/mcp.json`.

`resolveConfig()` still overrides all four nanoclaw env vars from `containerInput` after
reading the file, so even if the file has a stale `NANOCLAW_CHAT_JID` from a previous
run, the correct value is always used at proxy time.

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: MCP Server Aggregation, new note on
  group source file maintenance)
- Affected code: `container/agent-runner/src/cursor-runner.ts` (one new function + one call)
- Depends on: `fix-cursor-mcp-workspace-root` (already deployed)
- Risk: LOW — write failure is non-fatal; `resolveConfig()` still provides correct in-memory
  values regardless of file state
