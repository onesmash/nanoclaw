## ADDED Requirements

### Requirement: Process-Based Setup Workflow

安装流程 SHALL 不包含任何容器运行时（Docker、Apple Container）的安装、检测或构建步骤。安装步骤按以下顺序执行：Bootstrap → Check Environment → Claude Authentication → Set Up Channels → Mount Allowlist → Start Service → Verify。

#### Scenario: Bootstrap 成功后直接进入 Claude 认证

- **WHEN** `bash setup.sh` 执行成功且 `NODE_OK=true`、`DEPS_OK=true`、`NATIVE_OK=true`
- **THEN** 安装流程跳过任何容器运行时步骤，直接进入 Claude Authentication

#### Scenario: Check Environment 不输出容器字段

- **WHEN** 执行 `npx tsx setup/index.ts --step environment`
- **THEN** 输出的状态块 SHALL NOT 包含 `APPLE_CONTAINER` 或 `DOCKER` 字段
- **AND** 状态块 SHALL 包含 `PLATFORM`、`IS_WSL`、`IS_HEADLESS`、`HAS_ENV`、`HAS_AUTH`、`HAS_REGISTERED_GROUPS`

#### Scenario: container 步骤不再可用

- **WHEN** 执行 `npx tsx setup/index.ts --step container`
- **THEN** 系统返回 `Unknown step: container` 错误并退出，不执行任何构建操作

### Requirement: Setup Skill Troubleshooting

安装技能（SKILL.md）的故障排查区块 SHALL NOT 包含关于容器运行时（Docker daemon、Apple Container）的修复指引。

#### Scenario: Agent 无响应时的排查路径

- **WHEN** agent 对消息无响应
- **THEN** 排查指引 SHALL 引导检查 `logs/nanoclaw.log` 和触发词配置
- **AND** SHALL NOT 提及 Docker 或容器运行时启动命令
