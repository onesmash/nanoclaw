# Change: Remove HEARTBEAT.md Content from AGENTS.md

## Why

`buildSystemPromptAppend()` 在 `shared.ts` 中包含了 `heartbeatContent`（即 `HEARTBEAT.md` 的内容）。`syncAgentsMd()` 调用它来写入 `{groupDir}/AGENTS.md`，导致 HEARTBEAT.md 中的运行时任务（如 `/planning-with-files`）被写进 AGENTS.md，成为 Cursor agent 的持久系统指令。

HEARTBEAT.md 是一个运行时调度文件（记录周期性任务、心跳 checklist），不应作为系统上下文写入 AGENTS.md——它应只在心跳触发时以 prompt 方式传递给 agent，而非作为静态指令持续存在。

## What Changes

- `buildSystemPromptAppend(ctx)` 在 `shared.ts` 中排除 `heartbeatContent`，不再将其写入 AGENTS.md 的系统上下文
- HEARTBEAT.md 内容仍由 `claude-runner.ts` 在 prompt 构建时使用（不受影响）

## Impact

- Affected specs: `cursor-agent-execution`（MODIFIED: System Context Delivery — 明确排除 heartbeatContent）
- Affected code:
  - `container/agent-runner/src/shared.ts` — `buildSystemPromptAppend` 移除 `heartbeatContent`
