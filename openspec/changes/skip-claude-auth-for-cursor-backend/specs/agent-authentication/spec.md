# Capability: agent-authentication

## ADDED Requirements

### Requirement: Cursor Backend 启动检查

当 `AGENT_BACKEND=cursor` 时，系统 SHALL 跳过 Claude 认证检查，改为验证 Cursor agent CLI 是否可用。

系统 SHALL 通过执行 `agent --version` 验证 agent CLI 可执行；若命令不可用或失败，系统 SHALL 退出（exit code 1）并输出包含 "Cursor agent CLI not found or not usable" 及安装指引的错误信息。

#### Scenario: Cursor 模式下 agent CLI 可用

- **WHEN** `.env` 中设置 `AGENT_BACKEND=cursor`
- **AND** `agent --version` 可成功执行
- **THEN** 系统启动成功
- **AND** 日志显示 "Using Cursor agent CLI (AGENT_BACKEND=cursor)"
- **AND** 不执行 Claude 认证检查

#### Scenario: Cursor 模式下 agent CLI 不可用

- **WHEN** `.env` 中设置 `AGENT_BACKEND=cursor`
- **AND** `agent --version` 不可用（命令不存在或执行失败）
- **THEN** 系统启动失败，exit code 为 1
- **AND** 错误信息包含 "Cursor agent CLI not found or not usable"
- **AND** 错误信息提示用户安装 Cursor 并确保 agent CLI 在 PATH 中
- **AND** 错误信息建议运行 `agent --version` 验证

## MODIFIED Requirements

### Requirement: 启动时认证检查

当 `AGENT_BACKEND` 未设置或为 `claude` 时，系统 SHALL 在启动时检查可用的 Claude 认证方式，并输出清晰的日志信息。当 `AGENT_BACKEND=cursor` 时，系统 SHALL 执行 Cursor Backend 启动检查（见 Requirement: Cursor Backend 启动检查），不执行 Claude 认证检查。

#### Scenario: 启动时显示认证方式

- **WHEN** 系统启动
- **AND** `AGENT_BACKEND` 未设置或为 `claude`
- **THEN** 系统执行 Claude 认证检查
- **AND** 日志输出当前使用的认证方式(英文)
- **AND** 如果使用 claude CLI 会话，日志包含用户 email 和组织名称(如有)

#### Scenario: 启动时认证失败

- **WHEN** 系统启动
- **AND** `AGENT_BACKEND` 未设置或为 `claude`
- **AND** 所有 Claude 认证方式都不可用
- **THEN** 系统输出错误信息(英文)并退出
- **AND** 错误信息包含具体的操作指引
- **AND** exit code 为 1
