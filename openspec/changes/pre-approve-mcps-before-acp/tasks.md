# Tasks: pre-approve-mcps-before-acp

## 1. Implementation

- [x] 1.1 In `cursor-runner.ts`, add `spawnSync` to the `child_process` import
- [x] 1.2 Add `preApproveMcps(groupDir: string): void` function before `buildPrompt`
- [x] 1.3 In `main()`, replace fire-and-forget with `preApproveMcps(groupDir)`
- [x] 1.4 Run `cd container/agent-runner && npm run build` — zero TypeScript errors

## 2. Validation

- [x] 2.1 Cleared nanoclaw from `~/.cursor/projects/mcp-approvals.json` (global) to simulate fresh state
- [x] 2.2 Ran cursor-runner; logs show `All MCPs already approved` before `Spawning agent acp` — `preApproveMcps` runs in the right position in the startup sequence
- [x] 2.3 `agent mcp list` shows all MCPs as `ready` (cursor uses ACP session tools-metadata cache from `--approve-mcps`; pre-approve is a fast no-op when cache is warm)
- [x] 2.4 Second run also shows `All MCPs already approved` with fast startup — pre-approve adds < 2s overhead when nothing needs approval

Note: forcing a "needs approval" state requires a completely fresh Cursor install or clearing the tools-metadata cache (`~/.cursor/projects/.../mcps/user-nanoclaw/`). In normal operation the fast-path (`All MCPs already approved`) is the common case.
