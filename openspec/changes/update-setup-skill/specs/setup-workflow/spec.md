# Capability: setup-workflow

NanoClaw 初始安装向导的步骤流程与 AI agent 执行规范。

## ADDED Requirements

### Requirement: Setup Flow Without Container Step

Setup 向导 SHALL 不包含任何容器运行时安装、镜像构建或运行时选择步骤。Setup 流程为：Bootstrap → Check Environment → Claude Auth → Set Up Channels → Mount Allowlist → Start Service → Verify。

#### Scenario: 全新安装不涉及 Docker

- **WHEN** 用户在一台没有安装 Docker 的机器上执行 setup
- **THEN** setup 流程正常完成所有步骤
- **AND** 不出现任何关于 Docker 安装或容器镜像构建的提示

#### Scenario: SKILL.md 步骤编号连续

- **WHEN** AI agent 执行 setup SKILL.md
- **THEN** 步骤编号从 1 到 7 连续，无跳跃
- **AND** 不存在引用"步骤 3"为容器运行时的内容

---

### Requirement: Environment Check Without Container Detection

`setup/index.ts --step environment` 的状态输出 SHALL 不包含 `APPLE_CONTAINER` 或 `DOCKER` 字段。SKILL.md 的 Step 2 SHALL 不记录或引用这两个字段。

#### Scenario: 环境检查输出字段准确

- **WHEN** 执行 `npx tsx setup/index.ts --step environment`
- **THEN** 状态块包含 `PLATFORM`、`IS_WSL`、`IS_HEADLESS`、`HAS_ENV`、`HAS_AUTH`、`HAS_REGISTERED_GROUPS`
- **AND** 不包含 `APPLE_CONTAINER` 或 `DOCKER` 字段

---

### Requirement: Service Step Without Docker Group Fix

SKILL.md 的 Service 步骤 SHALL 不包含 `DOCKER_GROUP_STALE=true` 的处理逻辑（`setfacl`、docker.service.d socket-acl 配置等）。

#### Scenario: Service 步骤无 Docker 相关提示

- **WHEN** AI agent 执行 SKILL.md 的 Start Service 步骤
- **THEN** 不向用户展示任何关于 Docker socket 权限或 docker 组的修复指令

---

### Requirement: Troubleshooting References Process Logs

SKILL.md 故障排查区块 SHALL 引用 `process-*.log` 作为 agent 执行日志路径，而非 `container-*.log`。

故障排查中"agent 无响应"场景 SHALL 指导用户检查 `groups/{group}/logs/process-*.log`，并说明 agent 以 Node.js 子进程方式运行，无需容器运行时。

#### Scenario: 故障排查指向正确日志

- **WHEN** 用户遇到 agent 无响应问题
- **THEN** SKILL.md 故障排查指引用户查看 `groups/main/logs/process-*.log`
- **AND** 不引用 Docker daemon 或 Apple Container 运行时作为故障原因

---

### Requirement: Container Setup Script Removed

`setup/container.ts` SHALL 被删除，`setup/index.ts` 的 `STEPS` 注册表 SHALL 不包含 `container` 条目。

#### Scenario: setup index 不暴露 container 步骤

- **WHEN** 执行 `npx tsx setup/index.ts --step container`
- **THEN** 输出"Unknown step: container"并以非零退出码退出
- **AND** 不尝试构建容器镜像
