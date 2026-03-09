# Change: Cursor Backend 下跳过 Claude 认证检查

## Why

当用户设置 `AGENT_BACKEND=cursor` 时，agent 使用 Cursor CLI（`agent` 命令）作为后端，不依赖 Claude/Anthropic 的凭证。但当前启动逻辑无论 backend 为何，都会执行 `checkAuthentication()`，要求 API key、auth token 或 claude CLI 登录，导致 cursor 模式用户即使已配置 Cursor，仍被错误地要求配置 Claude 认证。

## What Changes

- 修改 `src/index.ts` 启动逻辑：根据 `AGENT_BACKEND` 分支执行不同的前置检查
  - `cursor` 模式：跳过 Claude 认证检查，改为验证 Cursor agent CLI 是否可用（`agent --version`）；不可用时 exit 并提示安装
  - `claude` 模式（默认）：保持现有 `checkAuthentication()` 行为
- 新增 `src/auth-check.ts` 中的 `checkCursorCli()` 函数：执行 `agent --version`，返回是否可用

## Impact

- **Affected specs**: `agent-authentication`（MODIFIED: 启动时认证检查增加 backend 条件分支）
- **Affected code**:
  - `src/index.ts` — 修改 `main()` 启动检查逻辑
  - `src/auth-check.ts` — 新增 `checkCursorCli()`
- **Breaking changes**: 无
- **Migration**: 无需迁移；现有 claude 模式用户行为不变
