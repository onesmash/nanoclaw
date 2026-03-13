## ADDED Requirements

### Requirement: HEARTBEAT.md Global Context
系统 SHALL 在 agent 启动时将 `groups/main/HEARTBEAT.md` 的内容注入 system prompt（若文件存在）。该文件包含定期任务清单，提醒 agent 需要周期性执行的职责。文件不存在时静默跳过，不报错。`NANOCLAW_HEARTBEAT_PATH` 环境变量由 `process-runner.ts` 注入。

#### Scenario: HEARTBEAT.md 存在时注入
- **WHEN** `groups/main/HEARTBEAT.md` 存在且 `NANOCLAW_HEARTBEAT_PATH` 已设置
- **THEN** 其内容出现在 system prompt 中，位于 `USER.md` 之后、`BOOTSTRAP.md` 之前

#### Scenario: HEARTBEAT.md 不存在时静默跳过
- **WHEN** `groups/main/HEARTBEAT.md` 不存在
- **THEN** system prompt 组装正常进行，无错误，顺序中不出现该文件的占位

### Requirement: MEMORY.md Global Context
系统 SHALL 在 agent 启动时将 `groups/main/MEMORY.md` 的内容注入 system prompt（若文件存在）。该文件包含 agent 的持久记忆，是跨会话保留的知识摘要。文件不存在时静默跳过，不报错。`NANOCLAW_MEMORY_PATH` 环境变量由 `process-runner.ts` 注入。

#### Scenario: MEMORY.md 存在时注入
- **WHEN** `groups/main/MEMORY.md` 存在且 `NANOCLAW_MEMORY_PATH` 已设置
- **THEN** 其内容出现在 system prompt 的最末尾，位于 `BOOTSTRAP.md` 之后

#### Scenario: MEMORY.md 不存在时静默跳过
- **WHEN** `groups/main/MEMORY.md` 不存在
- **THEN** system prompt 组装正常进行，无错误，顺序中不出现该文件的占位

## MODIFIED Requirements

### Requirement: Centralized System Prompt Assembly
System prompt 的拼接逻辑 SHALL 集中在 `shared.ts` 的 `buildSystemPromptAppend()` 函数中，由 `claude-runner` 和 `cursor-runner` 共同调用，不得在各 runner 中重复内联实现。拼接顺序固定为：`CLAUDE.md → TOOLS → SOUL → IDENTITY → USER → HEARTBEAT → BOOTSTRAP → MEMORY`。此顺序确保基础行为准则（CLAUDE.md）和工具说明（TOOLS）优先于角色/身份文件加载，记忆（MEMORY）作为最终上下文放在最后。

#### Scenario: 两个 runner 使用同一拼接函数
- **WHEN** `claude-runner` 或 `cursor-runner` 组装 system prompt
- **THEN** 均调用 `buildSystemPromptAppend(ctx)`，顺序一致

#### Scenario: 部分文件缺失时顺序不乱
- **WHEN** 仅 `IDENTITY.md` 和 `TOOLS.md` 存在，其余文件缺失
- **THEN** system prompt 仅包含这两个文件的内容，顺序为 TOOLS 在前、IDENTITY 在后

#### Scenario: 所有文件均存在时完整顺序正确
- **WHEN** CLAUDE.md、TOOLS.md、SOUL.md、IDENTITY.md、USER.md、HEARTBEAT.md、BOOTSTRAP.md、MEMORY.md 均存在
- **THEN** system prompt 中各文件内容按 `CLAUDE.md → TOOLS → SOUL → IDENTITY → USER → HEARTBEAT → BOOTSTRAP → MEMORY` 顺序拼接，各段以两个换行符分隔
