# Cursor Runner: System Context via AGENTS.md

**Date:** 2026-03-12

## Problem

`cursor-runner.ts` currently prepends system context (SOUL/IDENTITY/USER/globalClaudeMd/BOOTSTRAP/TOOLS) before the user prompt. This pollutes the user message with system instructions that should be invisible context.

## Solution

Write system context to `AGENTS.md` in the group directory. Cursor picks it up as project-level instructions. The user prompt stays clean.

## Design

### `syncAgentsMd(groupDir, ctx)`

- Always writes to `groupDir/AGENTS.md`
- Content = `buildSystemPromptAppend(ctx)` if non-empty, otherwise empty string
- Called before spawning `agent acp`, so Cursor sees updated context from session start
- Overwrites every invocation — keeps in sync with SOUL/IDENTITY/USER changes

### `buildPrompt` (simplified)

- Just applies `applyScheduledTaskPrefix` — no system context prepend

### Call order in `main()`

1. `loadSystemContext(containerInput)` → ctx
2. `syncAgentsMd(groupDir, ctx)` ← new, before agent spawn
3. Spawn `agent acp` (unchanged)
4. `buildPrompt(promptText, ...)` → bare user message

## Files Changed

- `container/agent-runner/src/cursor-runner.ts` — main change
- `shared.ts` — no changes needed

---

## Extension: Prepend Group CLAUDE.md for Main Groups

### Problem

For the main group (`isMain = true`), the group directory contains a `CLAUDE.md` with per-group memory and persistent instructions. Currently these are not included in `AGENTS.md`, so Cursor does not see them as project-level context.

Non-main groups already get `globalClaudeMd` (the top-level `CLAUDE.md`) injected via `loadSystemContext`, so they do not need this.

### Solution

When `isMain` is true, read `groupDir/CLAUDE.md` and prepend it before the `buildSystemPromptAppend(ctx)` output in `AGENTS.md`.

### Design

**`syncAgentsMd(groupDir, ctx, isMain)`**

- Add `isMain: boolean` parameter
- When `isMain` is true:
  - Read `groupDir/CLAUDE.md` (skip silently if file does not exist)
  - Final content = `{claudeMd}\n\n{systemContent}`
- When `isMain` is false: behavior unchanged

**Call site in `main()`**

```
syncAgentsMd(groupDir, ctx, containerInput.isMain);
```

### Order in AGENTS.md (isMain = true)

1. `groupDir/CLAUDE.md` — group memory & persistent instructions
2. `buildSystemPromptAppend(ctx)` — SOUL / IDENTITY / USER / TOOLS / etc.

### Files Changed

- `container/agent-runner/src/cursor-runner.ts` — `syncAgentsMd` signature + call site
