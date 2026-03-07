# Capability: debug-skill

NanoClaw `/debug` skill——指导用户排查进程代理执行问题的操作文档。

## ADDED Requirements

### Requirement: Process-Based Architecture Documentation

debug skill SHALL 以 Node.js 子进程模型描述 agent 执行架构，不包含任何 Docker/容器相关内容。

架构图须呈现：
- 宿主侧入口：`src/process-runner.ts`
- 执行方式：`spawn('node', ['container/agent-runner/dist/index.js'])`
- 路径传递：`NANOCLAW_GROUP_DIR`、`NANOCLAW_IPC_DIR`、`NANOCLAW_GLOBAL_DIR`、`HOME`（均为环境变量）
- 会话隔离：`HOME` 设为 `data/sessions/{folder}/`（每群组独立）

#### Scenario: 用户查阅架构图

- **WHEN** 用户打开 debug skill 查看架构
- **THEN** 文档呈现 `src/process-runner.ts` 通过 `node` 命令启动子进程
- **AND** 文档说明 `NANOCLAW_*` 环境变量替代原容器 volume mount
- **AND** 文档中不出现 `docker`、`container-runner.ts` 或任何容器运行时引用

---

### Requirement: Process Log Location

debug skill SHALL 将进程运行日志位置标注为 `groups/{folder}/logs/process-*.log`。

#### Scenario: 用户查看日志位置表

- **WHEN** 用户查看日志位置表
- **THEN** 进程运行日志指向 `groups/{folder}/logs/process-*.log`
- **AND** 不出现 `container-*.log` 路径

---

### Requirement: Relevant Common Issues Only

debug skill SHALL 仅包含适用于进程模式的常见问题排查条目，移除所有 Docker 专属问题。

保留条目：
1. "Process agent exited with code 1"（含认证缺失子原因）
2. "Session Not Resuming"（基于 `HOME` 环境变量，不再基于挂载路径）
3. "MCP Server Failures"

移除条目：
- "Environment Variables Not Passing"（Docker `-i` flag 问题）
- "Mount Issues"（无挂载机制）
- "Permission Issues"（无容器用户）
- "Root User Restriction"（子原因）

#### Scenario: 用户排查 exit code 1

- **WHEN** 用户遇到 "Process agent exited with code 1"
- **THEN** 文档指引查看 `groups/{folder}/logs/process-*.log`
- **AND** 文档说明检查 `.env` 中的认证配置

#### Scenario: 用户排查 session 不续期

- **WHEN** 用户发现每次对话都是新 session
- **THEN** 文档指引验证 `src/process-runner.ts` 中 `buildEnv` 的 `HOME` 设置
- **AND** 文档说明 `HOME` 应指向 `data/sessions/{groupFolder}/`
- **AND** 文档不再提及 `/home/node/.claude/` 或 `/root/.claude/` 挂载路径

---

### Requirement: Manual Process Testing Commands

debug skill SHALL 提供不依赖 Docker 的手动测试命令，直接启动 Node.js 子进程验证 agent 执行。

测试命令须包含：
- 设置 `NANOCLAW_*` 和 `HOME` 环境变量
- 通过 stdin 传入包含 `secrets` 的 `ContainerInput` JSON
- 执行 `node container/agent-runner/dist/index.js`

#### Scenario: 用户手动测试 agent 执行

- **WHEN** 用户按文档执行手动测试命令
- **THEN** 命令通过环境变量和 stdin 启动子进程
- **AND** 命令中不包含 `docker run` 或任何容器运行时调用

---

### Requirement: Agent Runner Build Check

debug skill SHALL 提供检查 agent-runner 构建产物的命令，替代原容器镜像检查。

#### Scenario: 用户检查构建状态

- **WHEN** 用户执行构建状态检查
- **THEN** 文档提供 `ls container/agent-runner/dist/index.js` 验证命令
- **AND** 文档说明缺失时执行 `npm run build`
- **AND** 文档不包含 `docker images` 或 `docker run --entrypoint` 命令

---

### Requirement: Accurate Quick Diagnostic Script

debug skill 的快速诊断脚本 SHALL 检查进程模式所需的先决条件，不检查容器运行时。

脚本须检查：
1. `.env` 中的认证配置
2. `container/agent-runner/dist/index.js` 构建产物是否存在
3. `groups/` 目录是否存在
4. 近期 `process-*.log` 日志
5. Session 连续性（同一群组连续消息复用相同 session ID）

脚本须移除：
- `docker info` 运行时检查
- `docker run` 容器镜像测试
- Session mount path 正确性检查（`/home/node/.claude/`）

#### Scenario: 用户运行快速诊断

- **WHEN** 用户执行快速诊断脚本
- **THEN** 脚本检查认证、agent-runner dist、groups 目录、近期进程日志、session 连续性
- **AND** 脚本不执行任何 docker 命令
