# Capability: agent-execution

Agent 执行层——NanoClaw 如何将消息/任务路由到 Claude Agent SDK 并收集结果。

## ADDED Requirements

### Requirement: Direct Process Execution

系统 SHALL 通过 `spawn('node', [AGENT_RUNNER_PATH])` 将 agent-runner 作为直接 Node.js 子进程执行，而非通过 Docker/Apple Container 容器运行。

`AGENT_RUNNER_PATH` 为 `path.join(process.cwd(), 'container/agent-runner/dist/index.js')`。

#### Scenario: 消息触发 agent 执行

- **WHEN** 一条消息路由到某个群组的 agent
- **THEN** 系统以 `node container/agent-runner/dist/index.js` 启动子进程
- **AND** 子进程不依赖 Docker daemon 或任何容器运行时

#### Scenario: 任务调度触发 agent 执行

- **WHEN** `task-scheduler` 触发一个定时任务
- **THEN** 系统以相同方式启动 Node.js 子进程执行 agent-runner
- **AND** 与消息触发路径使用相同的 `runProcessAgent()` 函数

---

### Requirement: Environment Variable Path Resolution

系统 SHALL 通过 `NANOCLAW_*` 环境变量向 agent-runner 子进程传递工作路径，替代原容器 volume mount 机制。

所需环境变量：

| 变量 | 值 | 说明 |
|------|----|------|
| `NANOCLAW_GROUP_DIR` | `resolveGroupFolderPath(group.folder)` | 群组工作目录 |
| `NANOCLAW_IPC_DIR` | `resolveGroupIpcPath(group.folder)` | IPC 文件目录 |
| `NANOCLAW_GLOBAL_DIR` | `path.join(GROUPS_DIR, 'global')` | 全局 CLAUDE.md 目录 |
| `NANOCLAW_EXTRA_DIR` | 第一个 `additionalMounts` 条目（如有） | 附加挂载目录 |
| `HOME` | `path.join(DATA_DIR, 'sessions', group.folder)` | Claude 会话数据目录 |
| `TZ` | `TIMEZONE` 配置值 | 时区 |

#### Scenario: 子进程接收正确路径

- **WHEN** 系统启动 agent-runner 子进程
- **THEN** 子进程环境中包含所有 `NANOCLAW_*` 变量和 `HOME`、`TZ`
- **AND** `NANOCLAW_GROUP_DIR` 指向宿主上该群组的真实绝对路径

#### Scenario: agent-runner 路径解析回退

- **WHEN** agent-runner 在容器内运行（未设置 `NANOCLAW_*` 环境变量）
- **THEN** agent-runner 回退使用 `/workspace/group`、`/workspace/ipc`、`/workspace/global` 等硬编码路径
- **AND** 容器模式下行为与变更前完全一致

---

### Requirement: Stdin/Stdout IPC Protocol Unchanged

agent-runner 子进程与宿主进程之间的 IPC 协议 SHALL 保持不变：

- 宿主通过 stdin 发送 `ContainerInput` JSON
- agent-runner 通过 stdout 输出 `OUTPUT_START...OUTPUT_END` 包裹的 `ContainerOutput` JSON
- Secrets（`ANTHROPIC_API_KEY`、`CLAUDE_CODE_OAUTH_TOKEN` 等）通过 `ContainerInput.secrets` 经 stdin 传递，不放入环境变量
- 流式输出、follow-up 消息轮询、空闲检测、超时处理逻辑全部不变

#### Scenario: 正常消息处理

- **WHEN** 宿主向子进程 stdin 发送 `ContainerInput` JSON
- **THEN** 子进程在 stdout 输出 `OUTPUT_START\n{...ContainerOutput JSON...}\nOUTPUT_END`
- **AND** 宿主正确解析响应并路由到对应渠道

#### Scenario: Secrets 不泄漏到环境变量

- **WHEN** 系统构建子进程的环境变量对象（`buildEnv()`）
- **THEN** `ANTHROPIC_API_KEY`、`CLAUDE_CODE_OAUTH_TOKEN` 等 secrets 不出现在环境变量中
- **AND** 这些 secrets 仅通过 `ContainerInput.secrets` 经 stdin 传入

---

### Requirement: Agent Runner Build Integration

系统 SHALL 在主构建流程中包含 agent-runner 的编译步骤，确保 `container/agent-runner/dist/index.js` 始终与源码同步。

`package.json` 脚本：

```json
{
  "build": "npm run build:agent-runner && tsc",
  "build:agent-runner": "cd container/agent-runner && npm install && tsc",
  "dev": "npm run build:agent-runner && tsx watch src/index.ts"
}
```

#### Scenario: npm run build 完整编译

- **WHEN** 开发者执行 `npm run build`
- **THEN** 先编译 `container/agent-runner`（生成 `container/agent-runner/dist/`）
- **AND** 再编译主项目 TypeScript
- **AND** 两者均无编译错误时构建成功

#### Scenario: npm run dev 热重载

- **WHEN** 开发者执行 `npm run dev`
- **THEN** 先完成 agent-runner 一次性编译
- **AND** 再以 tsx watch 模式启动主进程，监听主项目源文件变更

---

### Requirement: Container Runtime Removal

系统 SHALL 不再依赖 `src/container-runtime.ts` 中的容器生命周期管理逻辑。

`src/container-runtime.ts`（Docker daemon 检查、孤儿容器清理、`ensureContainerRuntimeRunning`）和对应测试文件 `src/container-runtime.test.ts` 均被删除。

`src/index.ts` 的 `main()` 函数中不再调用 `ensureContainerSystemRunning()`。

#### Scenario: 服务启动不检查 Docker

- **WHEN** NanoClaw 服务启动（`main()` 被调用）
- **THEN** 不执行任何 Docker daemon 可用性检查
- **AND** 不清理孤儿容器
- **AND** 服务在 Docker 未安装的环境中也能正常启动
