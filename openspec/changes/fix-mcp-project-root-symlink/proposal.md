# Change: Fix cursor-runner Writing Through Symlink to groupDir mcp.json

## Why

`cursor-runner` correctly writes the proxy URL to `projectRoot/.cursor/mcp.json`, but
if that path is a symlink pointing at `groups/{name}/.cursor/mcp.json`, the write follows
the symlink and overwrites the user-managed source config — violating the two-file
invariant established by `write-group-mcp-source`.

**Root cause observed in production:** `nanoclaw-zoom/.cursor/mcp.json` was a symlink to
`groups/main/.cursor/mcp.json`. Every cursor-runner session replaced the user-managed
source config with `{ "mcpServers": { "nanoclaw": { "url": "http://127.0.0.1:<port>" } } }`.

## What Changes

- **`cursor-runner.ts`**: before writing the proxy URL to `projectRoot/.cursor/mcp.json`,
  call `fs.lstatSync` to detect a symlink; if found, `fs.unlinkSync` it so the subsequent
  `fs.writeFileSync` creates a plain file instead of following the link. Log the break.

## Impact

- Affected specs: `cursor-agent-execution` (ADDED: Symlink-Safe Project Root Write)
- Affected code: `container/agent-runner/src/cursor-runner.ts` (~5 lines)
- Risk: NONE — no behaviour change when the path is already a plain file
- Depends on: `write-group-mcp-source` (formalises the two-file invariant this fix enforces)
