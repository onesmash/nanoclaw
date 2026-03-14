## 1. Implementation

- [x] 1.1 Add `isHeartbeatContentEffectivelyEmpty(content: string | null | undefined): boolean` to `src/task-scheduler.ts`
- [x] 1.2 Add preflight gate in `runTask()`: read HEARTBEAT.md, call `isHeartbeatContentEffectivelyEmpty`, skip + advance `next_run` if empty
- [x] 1.3 Export `isHeartbeatContentEffectivelyEmpty` for testing

## 2. Tests

- [x] 2.1 Unit tests for `isHeartbeatContentEffectivelyEmpty`: template content, actionable content, null/undefined, edge cases (`#TODO`, `- [ ]`, mixed)
- [x] 2.2 Integration test for `runTask()` skip path: HEARTBEAT.md empty → no `runContainerAgent`, `next_run` advanced, no `logTaskRun`
- [x] 2.3 Integration test: HEARTBEAT.md missing (ENOENT) → task runs normally
