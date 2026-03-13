## 1. shared.ts — Extend SystemContext and loadSystemContext

- [x] 1.1 Add `heartbeatContent?: string` and `memoryContent?: string` fields to the `SystemContext` interface in `container/agent-runner/src/shared.ts`
- [x] 1.2 In `loadSystemContext()`, read `NANOCLAW_HEARTBEAT_PATH` and `NANOCLAW_MEMORY_PATH` env vars using the existing `readIfExists` helper
- [x] 1.3 Include `heartbeatContent` and `memoryContent` in the returned `SystemContext` object

## 2. shared.ts — Reorder buildSystemPromptAppend

- [x] 2.1 Update `buildSystemPromptAppend()` to use the new order: `globalClaudeMd → toolsContent → soulContent → identityContent → userContent → heartbeatContent → bootstrapContent → memoryContent`

## 3. process-runner.ts — Add new env vars

- [x] 3.1 In `buildEnv()`, add `NANOCLAW_HEARTBEAT_PATH` pointing to `path.join(GROUPS_DIR, 'main', 'HEARTBEAT.md')`
- [x] 3.2 In `buildEnv()`, add `NANOCLAW_MEMORY_PATH` pointing to `path.join(GROUPS_DIR, 'main', 'MEMORY.md')`

## 4. Verification

- [x] 4.1 Run `npm run typecheck` to confirm no TypeScript errors
- [x] 4.2 Confirm `claude-runner.ts` and `cursor-runner.ts` require no changes (they call `buildSystemPromptAppend(ctx)` unchanged)
