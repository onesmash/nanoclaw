# Change: Reorder System Prompt Append and Add HEARTBEAT/MEMORY Context

## Why

The current `buildSystemPromptAppend()` order (`SOUL → IDENTITY → USER → CLAUDE.md → BOOTSTRAP → TOOLS`) puts persona files before ground rules, causing behavioral guidelines to be overridden by identity layers. Additionally, HEARTBEAT.md (periodic task checklist) and MEMORY.md (persistent memory) are not included in the system prompt at all, so agents lack these critical runtime contexts.

## What Changes

- `container/agent-runner/src/shared.ts` — `SystemContext` interface gains two new optional fields: `heartbeatContent` and `memoryContent`; `loadSystemContext()` reads `NANOCLAW_HEARTBEAT_PATH` and `NANOCLAW_MEMORY_PATH` env vars (files are optional, missing ones are silently skipped); `buildSystemPromptAppend()` order changes to: `CLAUDE.md → TOOLS → SOUL → IDENTITY → USER → HEARTBEAT → BOOTSTRAP → MEMORY`
- `src/process-runner.ts` — `buildEnv()` gains two new env vars: `NANOCLAW_HEARTBEAT_PATH` (pointing to `groups/main/HEARTBEAT.md`) and `NANOCLAW_MEMORY_PATH` (pointing to `groups/main/MEMORY.md`)
- `claude-runner.ts` and `cursor-runner.ts` pick up the new order automatically via `buildSystemPromptAppend(ctx)` — no changes needed

## Impact

- Affected specs: `agent-context` (MODIFIED: Centralized System Prompt Assembly; ADDED: HEARTBEAT.md Global Context; ADDED: MEMORY.md Global Context)
- Affected code: `container/agent-runner/src/shared.ts`, `src/process-runner.ts`
- Design doc: `docs/plans/2026-03-12-system-prompt-order-design.md`
- Depends on: `add-soul-user-context` (defines `SystemContext`, `loadSystemContext`, `buildSystemPromptAppend` in `shared.ts`)
