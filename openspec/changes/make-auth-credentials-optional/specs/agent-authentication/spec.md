# Agent Authentication Specification

## ADDED Requirements

### Requirement: Claude CLI 会话认证

系统 SHALL 支持通过 `claude` CLI 的已登录会话进行认证,无需配置 API key。

#### Scenario: 已登录 claude CLI,无 API key

- **WHEN** 用户未在 `.env` 中配置 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`
- **AND** 用户已通过 `claude login` 登录
- **THEN** 系统启动成功
- **AND** 日志显示 "Using claude CLI session authentication ({email})"
- **AND** Agent SDK 使用 claude CLI 会话进行 API 调用

#### Scenario: claude CLI 未登录,无 API key

- **WHEN** 用户未在 `.env` 中配置任何认证凭证
- **AND** 用户未登录 `claude` CLI
- **THEN** 系统启动失败,exit code 为 1
- **AND** 错误信息包含 "No authentication credentials found"
- **AND** 错误信息包含 "claude CLI not logged in"
- **AND** 错误信息提示用户运行 `claude login` 或配置 `ANTHROPIC_API_KEY`

### Requirement: 认证优先级

系统 SHALL 按以下优先级选择认证方式: API key > Auth token > Claude CLI 会话。

#### Scenario: 同时存在 API key 和 claude CLI 会话

- **WHEN** 用户在 `.env` 中配置了 `ANTHROPIC_API_KEY`
- **AND** 用户已登录 `claude` CLI
- **THEN** 系统使用 `ANTHROPIC_API_KEY` 进行认证
- **AND** 日志显示 "使用 ANTHROPIC_API_KEY 认证"

#### Scenario: 同时存在 Auth token 和 claude CLI 会话

- **WHEN** 用户在 `.env` 中配置了 `ANTHROPIC_AUTH_TOKEN`
- **AND** 用户未配置 `ANTHROPIC_API_KEY`
- **AND** 用户已登录 `claude` CLI
- **THEN** 系统使用 `ANTHROPIC_AUTH_TOKEN` 进行认证
- **AND** 日志显示 "使用 ANTHROPIC_AUTH_TOKEN 认证"

### Requirement: 启动时认证检查

系统 SHALL 在启动时检查可用的认证方式,并输出清晰的日志信息。

#### Scenario: 启动时显示认证方式

- **WHEN** 系统启动
- **THEN** 系统执行认证检查
- **AND** 日志输出当前使用的认证方式(英文)
- **AND** 如果使用 claude CLI 会话,日志包含用户 email 和组织名称(如有)

#### Scenario: 启动时认证失败

- **WHEN** 系统启动
- **AND** 所有认证方式都不可用
- **THEN** 系统输出错误信息(英文)并退出
- **AND** 错误信息包含具体的操作指引
- **AND** exit code 为 1

### Requirement: 可选凭证传递

系统 SHALL 将认证凭证作为可选项传递给 Agent SDK,而非强制要求。

#### Scenario: 传递存在的凭证

- **WHEN** `.env` 中配置了 `ANTHROPIC_API_KEY`
- **THEN** 系统通过 stdin 将该凭证传递给子进程
- **AND** 凭证不作为环境变量暴露

#### Scenario: 不传递不存在的凭证

- **WHEN** `.env` 中未配置任何认证凭证
- **THEN** 系统不传递任何认证凭证给子进程
- **AND** Agent SDK 自动使用 claude CLI 会话

#### Scenario: 过滤空值凭证

- **WHEN** `.env` 中某个凭证字段存在但值为空字符串
- **THEN** 系统不传递该凭证
- **AND** 该凭证被视为未配置

### Requirement: 向后兼容

系统 SHALL 保持与现有 API key 认证方式的完全兼容。

#### Scenario: 现有 API key 用户无需改动

- **WHEN** 用户已在 `.env` 中配置 `ANTHROPIC_API_KEY`
- **THEN** 系统行为与之前完全一致
- **AND** 无需任何配置改动
- **AND** 启动日志显示 "Using ANTHROPIC_API_KEY authentication"

#### Scenario: 现有 Auth token 用户无需改动

- **WHEN** 用户已在 `.env` 中配置 `ANTHROPIC_AUTH_TOKEN`
- **THEN** 系统行为与之前完全一致
- **AND** 无需任何配置改动
- **AND** 启动日志显示 "Using ANTHROPIC_AUTH_TOKEN authentication"
