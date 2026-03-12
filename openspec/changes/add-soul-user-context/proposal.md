# Change: Add SOUL.md and USER.md to Agent System Context

## Why

Agent 的 system prompt 缺少两类关键上下文：定义 agent 价值观和行为风格的"灵魂"，以及描述服务对象（用户）背景的"用户档案"。目前这些信息无处放置，只能混入 `IDENTITY.md` 或 `CLAUDE.md`，导致关注点不清晰。

## What Changes

- `src/process-runner.ts` — `buildEnv()` 新增 `NANOCLAW_SOUL_PATH`、`NANOCLAW_USER_PATH` 两个环境变量，指向 `groups/main/SOUL.md` 和 `groups/main/USER.md`
- `container/agent-runner/src/shared.ts` — `SystemContext` 接口新增 `soulContent`、`userContent` 字段；`loadSystemContext` 读取这两个文件（文件不存在则静默跳过）；新增 `buildSystemPromptAppend()` 函数集中管理拼接逻辑，供两个 runner 共用
- `container/agent-runner/src/claude-runner.ts` — 改用 `buildSystemPromptAppend()`，移除内联拼接
- `container/agent-runner/src/cursor-runner.ts` — 改用 `buildSystemPromptAppend()`，移除内联拼接
- System prompt 拼接顺序：`SOUL → IDENTITY → USER → CLAUDE.md → BOOTSTRAP → TOOLS`

## Impact

- Affected specs: `agent-context`（ADDED: SOUL.md Global Context、ADDED: USER.md Global Context、ADDED: Centralized System Prompt Assembly）
- Affected code: `src/process-runner.ts`（`buildEnv`）、`container/agent-runner/src/shared.ts`（`SystemContext`、`loadSystemContext`、新增 `buildSystemPromptAppend`）、`container/agent-runner/src/claude-runner.ts`、`container/agent-runner/src/cursor-runner.ts`
- Design doc: `docs/plans/2026-03-12-soul-user-context-design.md`
