# Capability: agent-execution

## ADDED Requirements

### Requirement: Cursor CLI Agent Backend

系统 SHALL 支持通过 `AGENT_BACKEND=cursor` 环境变量将 Cursor CLI 作为可替换的 agent 后端。

`container/agent-runner/src/index.ts` SHALL 重构为薄分发器：读取 `AGENT_BACKEND` 环境变量，路由到 `claude-runner.ts`（默认）或 `cursor-runner.ts`。

`src/process-runner.ts` SHALL 将 `AGENT_BACKEND` 传入子进程环境变量。`src/index.ts` 和 `src/task-scheduler.ts` 无需任何改动。

#### Scenario: 环境变量切换到 Cursor 后端

- **WHEN** `.env` 中设置 `AGENT_BACKEND=cursor`
- **THEN** `index.ts` 分发器调用 `cursor-runner.ts` 的 `main()`
- **AND** `src/index.ts` 和 `src/task-scheduler.ts` 的代码路径不变

#### Scenario: 默认保持 Claude 后端

- **WHEN** `AGENT_BACKEND` 未设置或为 `claude`
- **THEN** `index.ts` 分发器调用 `claude-runner.ts` 的 `main()`，行为与变更前完全一致

---

### Requirement: Agent Runner Shared Module

系统 SHALL 将 `ContainerInput`、`ContainerOutput` 接口及 `readStdin`、`writeOutput`、`OUTPUT_START_MARKER`、`OUTPUT_END_MARKER` 提取到 `shared.ts` 中，供 `claude-runner.ts` 和 `cursor-runner.ts` 共同复用。

#### Scenario: 公共类型和工具共享

- **WHEN** `claude-runner.ts` 或 `cursor-runner.ts` 需要读写 IPC
- **THEN** 两者均从 `./shared.js` import，不重复定义

---

### Requirement: Cursor Runner IPC Compatibility

`container/agent-runner/src/cursor-runner.ts` SHALL 实现与 `claude-runner.ts` 完全相同的 stdin/stdout IPC 协议。

内部实现：spawn `agent -p <prompt> --output-format stream-json --stream-partial-output --force --trust --approve-mcps --workspace <groupDir> [--resume <sessionId>]`，将 NDJSON 输出转译为 `OUTPUT_START...OUTPUT_END` markers。

Auth 由 `agent login` 本地管理，spawn 时不传任何 API key。

#### Scenario: stdin 接收 ContainerInput

- **WHEN** `process-runner.ts` 向 `index.ts`（cursor 模式）的 stdin 写入 `ContainerInput` JSON
- **THEN** `cursor-runner.ts` 解析 `prompt`、`sessionId`、`groupFolder` 字段，以正确参数 spawn `agent -p`

#### Scenario: 首次对话（无 sessionId）

- **WHEN** `ContainerInput.sessionId` 为空
- **THEN** spawn 命令不含 `--resume`，从 `system init` 事件取出 `session_id` 写入 `ContainerOutput.newSessionId`

#### Scenario: 续接对话（有 sessionId）

- **WHEN** `ContainerInput.sessionId` 有值
- **THEN** spawn 命令含 `--resume <sessionId>`

---

### Requirement: IPC MCP Server for Cursor Agent

`cursor-runner.ts` SHALL 在 spawn `agent -p` 前，向群组 workspace 写入 `.cursor/mcp.json`，将 `dist/ipc-mcp-stdio.js` 注册为 MCP server，携带 `NANOCLAW_IPC_DIR`、`NANOCLAW_CHAT_JID`、`NANOCLAW_GROUP_FOLDER`、`NANOCLAW_IS_MAIN` 环境变量，使 Cursor agent 拥有与 Claude agent 相同的 `send_message`、`create_task` 等 IPC 工具。

#### Scenario: MCP server 可用

- **WHEN** Cursor agent 在 workspace 内运行
- **THEN** `.cursor/mcp.json` 中包含 `ipc-mcp-stdio` server 配置
- **AND** Cursor agent 可调用 `send_message` 工具发送中间消息

---

### Requirement: Cursor CLI NDJSON to IPC Translation

`cursor-runner.ts` SHALL 将 Cursor CLI `stream-json` NDJSON 输出逐行转译为 IPC markers：

| 事件类型 | 处理方式 |
|---------|---------|
| `system` (init) | 取 `session_id`，暂存为 `newSessionId` |
| `assistant` | 取 `message.content[0].text`，写入流式中间 `writeOutput({ status:'success', result: text })` |
| `result` (is_error: false) | 写入最终 `writeOutput({ status:'success', result, newSessionId })` |
| `result` (is_error: true) | 写入最终 `writeOutput({ status:'error', error })` |
| `thinking`、`tool_call` | 忽略 |

#### Scenario: 流式推送中间结果

- **WHEN** Cursor CLI 输出 `assistant` 类型事件
- **THEN** `cursor-runner` 调用 `writeOutput`，`process-runner.ts` 的 `onOutput` 回调触发实时推送

#### Scenario: 输出最终结果

- **WHEN** Cursor CLI 输出 `result` 事件且 `is_error: false`
- **THEN** `cursor-runner` 输出 `{ "status": "success", "result": "...", "newSessionId": "<session_id>" }`

#### Scenario: 处理错误结果

- **WHEN** Cursor CLI 输出 `result` 事件且 `is_error: true`
- **THEN** `cursor-runner` 输出 `{ "status": "error", "error": "..." }`
