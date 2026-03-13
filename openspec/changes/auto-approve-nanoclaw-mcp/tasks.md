# Tasks: auto-approve-nanoclaw-mcp

## 1. Implementation

- [x] 1.1 In `cursor-runner.ts`, after the `syncMcpJson(groupDir, mcpServerPath, containerInput)` call, add a fire-and-forget spawn with `cwd: projectRoot` (derived from `__dirname`) so cursor writes to the correct project-specific `mcp-approvals.json`:
  ```ts
  const projectRoot = path.resolve(__dirname, '../../..');
  const approveProc = spawn('cursor', ['agent', 'mcp', 'enable', 'nanoclaw'], {
    detached: true,
    stdio: 'ignore',
    cwd: projectRoot,
  });
  approveProc.unref();
  ```
  Note: `cwd: projectRoot` is required — without it, cursor writes to global `~/.cursor/projects/mcp-approvals.json` instead of the project-specific approvals file that `cursor agent mcp list` reads.
- [x] 1.2 Run `cd container/agent-runner && npm run build` — zero TypeScript errors

## 2. Validation

- [x] 2.1 Removed all nanoclaw entries from `~/.cursor/projects/Users-hui-xu-SourceCode-nanoclaw-zoom/mcp-approvals.json` to force "needs approval" state (backup at `.../mcp-approvals.json.bak`)
- [x] 2.2 Confirmed `cursor agent mcp list` shows `nanoclaw: not loaded (needs approval)`
- [x] 2.3 Started a cursor-runner session by running agent-runner directly with test input (same path as nanoclaw service heartbeat runs)
- [x] 2.4 Within ~3 seconds after session start, `cursor agent mcp list` shows `nanoclaw: ready` — fire-and-forget wrote `nanoclaw-53554cecbb6e54a0` to project-specific approvals
- [x] 2.5 ACP session started before background enable completed (fire-and-forget spawned before `agent acp` is launched, runs asynchronously)
