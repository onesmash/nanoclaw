# Capability: agent-execution

## MODIFIED Requirements

### Requirement: Agent Runner Shared Module

系统 SHALL 将以下内容提取到 `shared.ts` 中，供 `claude-runner.ts` 和 `cursor-runner.ts` 共同复用：

**类型和 IPC 工具（原有）：**
`ContainerInput`、`ContainerOutput` 接口及 `readStdin`、`writeOutput`、`OUTPUT_START_MARKER`、`OUTPUT_END_MARKER`。

**IPC 轮询函数（新增）：**
`IPC_POLL_MS`、`shouldClose(ipcInputCloseSentinel)`、`drainIpcInput(ipcInputDir)`、`waitForIpcMessage(ipcInputDir, ipcInputCloseSentinel)`。

**系统上下文加载函数（新增）：**
`SystemContext` 接口、`loadSystemContext(containerInput)` 函数（读取 identity、global CLAUDE.md、BOOTSTRAP.md、TOOLS.md、NANOCLAW_EXTRA_DIR 子目录）、`applyScheduledTaskPrefix(prompt, isScheduledTask?)` 函数。

#### Scenario: 公共类型和工具共享

- **WHEN** `claude-runner.ts` 或 `cursor-runner.ts` 需要读写 IPC
- **THEN** 两者均从 `./shared.js` import，不重复定义

#### Scenario: IPC 轮询函数共享

- **WHEN** `claude-runner.ts` 或 `cursor-runner.ts` 需要轮询 IPC 消息目录或检测 close sentinel
- **THEN** 两者均调用 `shared.ts` 导出的 `drainIpcInput`、`waitForIpcMessage`、`shouldClose`，不各自实现

#### Scenario: 系统上下文加载共享

- **WHEN** 任一 runner 需要读取 identity / global CLAUDE.md / BOOTSTRAP.md / TOOLS.md
- **THEN** 调用 `loadSystemContext(containerInput)` 获取统一的 `SystemContext` 对象，不在 runner 内重复读取文件

---

### Requirement: Cursor Runner IPC Compatibility

`container/agent-runner/src/cursor-runner.ts` SHALL 实现与 `claude-runner.ts` 完全相同的 stdin/stdout IPC 协议。

内部实现：spawn `agent <prompt> --print --output-format stream-json --stream-partial-output --force --trust --approve-mcps --workspace <groupDir> [--resume <sessionId>]`（prompt 为位置参数，`--print` 为布尔标志），将 NDJSON 输出转译为 `OUTPUT_START...OUTPUT_END` markers。

`containerInput.secrets` SHALL 合并到 spawn 进程的 `env` 选项中。

Auth 由 `agent login` 本地管理，spawn 时不传任何 API key。

#### Scenario: stdin 接收 ContainerInput

- **WHEN** `process-runner.ts` 向 `index.ts`（cursor 模式）的 stdin 写入 `ContainerInput` JSON
- **THEN** `cursor-runner.ts` 解析 `prompt`、`sessionId`、`groupFolder` 字段，以正确参数 spawn `agent`

#### Scenario: secrets 注入

- **WHEN** `ContainerInput.secrets` 包含键值对
- **THEN** 所有键值对合并到 spawn 子进程的环境变量中

#### Scenario: 首次对话（无 sessionId）

- **WHEN** `ContainerInput.sessionId` 为空
- **THEN** spawn 命令不含 `--resume`，从 `system init` 事件取出 `session_id` 写入 `ContainerOutput.newSessionId`

#### Scenario: 续接对话（有 sessionId）

- **WHEN** `ContainerInput.sessionId` 有值
- **THEN** spawn 命令含 `--resume <sessionId>`

#### Scenario: 错误时携带 newSessionId

- **WHEN** spawn 进程异常退出且已从 `system init` 事件获取到 `session_id`
- **THEN** error output 中携带 `newSessionId`

---

## ADDED Requirements

### Requirement: Cursor Runner Multi-Turn IPC Loop

`cursor-runner.ts` SHALL 实现多轮 IPC 对话循环，在单次容器生命周期内持续接收来自宿主进程的消息，等价于 `claude-runner.ts` 的 while 循环语义。

实现方式：每轮 spawn 完成后调用 `waitForIpcMessage()`；收到新消息则以 `--resume <sessionId>` 重新 spawn `agent`；收到 null（close sentinel）则退出循环。

#### Scenario: 单次容器多轮对话

- **WHEN** `agent` spawn 完成后宿主进程写入新 IPC 消息
- **THEN** `cursor-runner` 以新 prompt 和最新 `sessionId` 重新 spawn `agent --resume`
- **AND** 继续等待下一轮消息，直到收到 close sentinel

#### Scenario: close sentinel 触发退出

- **WHEN** IPC 目录中出现 `_close` sentinel 文件
- **THEN** `waitForIpcMessage` 返回 null，`cursor-runner` 退出 while 循环并正常退出

#### Scenario: 启动时清理 close sentinel

- **WHEN** `cursor-runner` 启动
- **THEN** 若 `_close` 文件已存在则删除，防止残留 sentinel 干扰本次运行

#### Scenario: 积压 IPC 消息追加到初始 prompt

- **WHEN** `cursor-runner` 启动时 IPC 消息目录中已有消息文件
- **THEN** 这些消息追加到初始 prompt 一并发送给第一次 spawn 的 `agent`

---

### Requirement: Cursor Runner System Context Injection

`cursor-runner.ts` SHALL 在构建 prompt 时，通过 `loadSystemContext()` 读取系统上下文文件，并将内容前置到 prompt 字符串（通过 `---` 分隔符与用户消息区分）。

scheduled task 消息 SHALL 通过 `applyScheduledTaskPrefix()` 添加 `[SCHEDULED TASK]` 前缀。

#### Scenario: 系统上下文前置到 prompt

- **WHEN** workspace 中存在 BOOTSTRAP.md、TOOLS.md，或 identity / global CLAUDE.md 可读
- **THEN** 这些内容拼接后前置于 prompt，Cursor agent 在每次 spawn 时均可获取系统上下文

#### Scenario: 无系统上下文时直接使用原 prompt

- **WHEN** 所有上下文文件均不存在
- **THEN** prompt 不变，直接传递给 `agent`

#### Scenario: scheduled task 前缀

- **WHEN** `ContainerInput.isScheduledTask` 为 true
- **THEN** prompt 前添加 `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]`

---

### Requirement: Cursor Runner Global MCP Config

`cursor-runner.ts` SHALL 在 spawn `agent` 前将 MCP server 配置写入 `~/.cursor/mcp.json`（全局路径），agent 退出后在 `finally` 块中恢复原文件内容（若原文件存在）或删除该文件。

#### Scenario: 写入全局 MCP 配置

- **WHEN** `cursor-runner` 在 spawn 前写入 `~/.cursor/mcp.json`
- **THEN** Cursor CLI 全局 MCP 配置包含 nanoclaw IPC server

#### Scenario: 退出后恢复原配置

- **WHEN** spawn 前 `~/.cursor/mcp.json` 已存在
- **THEN** agent 退出后文件内容恢复为原始内容

#### Scenario: 退出后删除新建文件

- **WHEN** spawn 前 `~/.cursor/mcp.json` 不存在
- **THEN** agent 退出后删除该文件

---

### Requirement: Cursor Runner Sandbox Additional Directories

`cursor-runner.ts` SHALL 向工作区写入 `.cursor/sandbox.json`，将 `NANOCLAW_EXTRA_DIR` 下的所有子目录声明为 `additionalReadwritePaths`，等价于 `claude-runner.ts` 的 `additionalDirectories` 参数。

#### Scenario: 声明额外可读写目录

- **WHEN** `NANOCLAW_EXTRA_DIR` 环境变量指向一个包含子目录的目录
- **THEN** `<groupDir>/.cursor/sandbox.json` 的 `additionalReadwritePaths` 包含所有子目录路径
- **AND** Cursor agent 拥有对这些目录的读写访问权限

#### Scenario: 无额外目录时写入空配置

- **WHEN** `NANOCLAW_EXTRA_DIR` 未设置或不存在
- **THEN** `sandbox.json` 的 `additionalReadwritePaths` 为空数组
