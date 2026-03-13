# Change: Write System Context to AGENTS.md in cursor-runner

## Why

`cursor-runner.ts` 当前将系统上下文（SOUL/IDENTITY/USER/globalClaudeMd/BOOTSTRAP/TOOLS）拼接在用户 prompt 前面发送给 Cursor agent。这会导致：
- 用户 prompt 被系统指令污染，影响对话质量
- 每次 prompt 都重复携带大量系统上下文，浪费 token
- Cursor 原生支持通过 `AGENTS.md` 提供项目级指令，这是更合适的传递方式

## What Changes

- `cursor-runner.ts` 新增 `syncAgentsMd(groupDir, ctx)` 函数：在 spawn `agent acp` 前，将系统上下文写入 `{groupDir}/AGENTS.md`（始终写入，无内容时清空文件）
- `cursor-runner.ts` 的 `buildPrompt` 简化为只应用 scheduled task prefix，不再拼接系统上下文前缀
- `shared.ts` 不需要改动

## Impact

- Affected specs: `cursor-agent-execution`（MODIFIED: System Context Delivery）
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — 新增 `syncAgentsMd()`，简化 `buildPrompt()`
- Design doc: `docs/plans/2026-03-12-cursor-runner-agents-md-design.md`
- Depends on: `add-soul-user-context`（`loadSystemContext` 和 `buildSystemPromptAppend` 在 `shared.ts` 中定义）
