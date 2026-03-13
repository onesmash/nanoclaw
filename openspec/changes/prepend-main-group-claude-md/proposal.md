# Change: Prepend Group CLAUDE.md to AGENTS.md for Main Groups

## Why

Main groups (`isMain = true`) store per-group persistent memory and instructions in `{groupDir}/CLAUDE.md`. Currently `syncAgentsMd` writes only `buildSystemPromptAppend(ctx)` to `AGENTS.md`, so the group-level `CLAUDE.md` is invisible to Cursor.

Non-main groups already receive the global `CLAUDE.md` via `loadSystemContext` (injected as `globalClaudeMd`), so they are unaffected. Only the main group is missing its group-specific `CLAUDE.md` from the agent context.

## What Changes

- `syncAgentsMd(groupDir, ctx)` gains an `isMain: boolean` parameter
- When `isMain` is `true`: read `{groupDir}/CLAUDE.md` (skip silently if absent) and prepend it before `buildSystemPromptAppend(ctx)` in `AGENTS.md`
- When `isMain` is `false`: behavior unchanged

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: System Context Delivery — extend AGENTS.md content rule for main groups)
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — `syncAgentsMd` signature + call site
- Design doc: `docs/plans/2026-03-12-cursor-runner-agents-md-design.md` (Extension section)
- Depends on: `write-system-context-to-agents-md` (defines `syncAgentsMd` and `buildSystemPromptAppend`)
