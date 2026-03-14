# Change: Skip Heartbeat When HEARTBEAT.md Is Empty or Template

## Why

When HEARTBEAT.md contains only template comments and no actionable tasks, the heartbeat scheduler still spawns a container and invokes the LLM — wasting tokens on a no-op. This change adds a preflight check to skip execution entirely when the file has no real content.

## What Changes

- Add `isHeartbeatContentEffectivelyEmpty()` to `src/task-scheduler.ts` (ported from openclaw)
- Add a preflight gate in `runTask()`: if HEARTBEAT.md exists and is effectively empty, skip the run but still advance `next_run`
- No `logTaskRun` entry written on skip (a skip is not a run)

## Impact

- Affected specs: `heartbeat`
- Affected code: `src/task-scheduler.ts`
- Reference design: `docs/plans/2026-03-14-heartbeat-skip-empty-design.md`
