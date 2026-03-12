## ADDED Requirements

### Requirement: SOUL.md Global Context
系统 SHALL 在 agent 启动时将 `groups/main/SOUL.md` 的内容注入 system prompt（若文件存在）。该文件定义 agent 的价值观、行为风格和性格原则，对所有群组生效。文件不存在时静默跳过，不报错。

#### Scenario: SOUL.md 存在时注入
- **WHEN** `groups/main/SOUL.md` 存在
- **THEN** 其内容出现在 system prompt 的最前面，位于 `IDENTITY.md` 之前

#### Scenario: SOUL.md 不存在时静默跳过
- **WHEN** `groups/main/SOUL.md` 不存在
- **THEN** system prompt 组装正常进行，无错误，顺序中不出现该文件的占位

### Requirement: USER.md Global Context
系统 SHALL 在 agent 启动时将 `groups/main/USER.md` 的内容注入 system prompt（若文件存在）。该文件描述用户的背景、偏好和习惯，对所有群组生效。文件不存在时静默跳过，不报错。

#### Scenario: USER.md 存在时注入
- **WHEN** `groups/main/USER.md` 存在
- **THEN** 其内容出现在 system prompt 中 `IDENTITY.md` 之后、`CLAUDE.md` 之前

#### Scenario: USER.md 不存在时静默跳过
- **WHEN** `groups/main/USER.md` 不存在
- **THEN** system prompt 组装正常进行，无错误，顺序中不出现该文件的占位

### Requirement: Centralized System Prompt Assembly
System prompt 的拼接逻辑 SHALL 集中在 `shared.ts` 的 `buildSystemPromptAppend()` 函数中，由 `claude-runner` 和 `cursor-runner` 共同调用，不得在各 runner 中重复内联实现。拼接顺序固定为：`SOUL → IDENTITY → USER → CLAUDE.md → BOOTSTRAP → TOOLS`。

#### Scenario: 两个 runner 使用同一拼接函数
- **WHEN** `claude-runner` 或 `cursor-runner` 组装 system prompt
- **THEN** 均调用 `buildSystemPromptAppend(ctx)`，顺序一致

#### Scenario: 部分文件缺失时顺序不乱
- **WHEN** 仅 `IDENTITY.md` 和 `TOOLS.md` 存在，其余文件缺失
- **THEN** system prompt 仅包含这两个文件的内容，顺序为 IDENTITY 在前、TOOLS 在后
