# Change: Align cursor-runner.ts with claude-runner.ts

## Why

`cursor-runner.ts`（由 `add-cursor-agent` 引入）缺少 `claude-runner.ts` 的多项关键能力：多轮 IPC 对话循环、secrets 注入、系统上下文注入、全局 MCP 配置管理、额外目录访问声明、scheduled task 前缀处理等。此外，spawn 参数存在一个 bug（`-p` 被错误地当作带值参数）。同时，IPC 轮询函数和系统上下文加载逻辑在两个 runner 之间存在重复，需提取到 `shared.ts`。

## What Changes

- **Bug 修复**：`cursor-runner.ts` spawn args 中 `-p <prompt>` 改为位置参数 + `--print` 布尔标志
- **多轮 IPC 对话循环**：`cursor-runner.ts` 实现 `waitForIpcMessage()` + while 循环，每轮重新 spawn `agent --resume <sessionId>`，行为与 `claude-runner.ts` 的 while 循环语义一致
- **Shared IPC 函数**：`shouldClose`、`drainIpcInput`、`waitForIpcMessage`、`IPC_POLL_MS` 提取到 `shared.ts`；`claude-runner.ts` 删除本地定义，改为 import
- **Shared 系统上下文加载**：`loadSystemContext()`、`applyScheduledTaskPrefix()` 提取到 `shared.ts`；`claude-runner.ts` 重构使用这两个函数；`cursor-runner.ts` 用这两个函数拼接 prompt 前缀
- **全局 MCP 配置**：`cursor-runner.ts` 将 MCP server 写入 `~/.cursor/mcp.json`（而非工作区），agent 退出后在 `finally` 中恢复或删除原文件
- **沙箱额外目录**：`cursor-runner.ts` 向工作区写入 `.cursor/sandbox.json`，声明 `NANOCLAW_EXTRA_DIR` 下的子目录为 `additionalReadwritePaths`
- **Secrets 注入**：`cursor-runner.ts` 将 `containerInput.secrets` 合并到 spawn 的 `env`
- **Close sentinel 清理**：`cursor-runner.ts` 启动时 unlink `_close` sentinel 文件
- **Pending IPC drain**：`cursor-runner.ts` 启动时把积压 IPC 消息追加到初始 prompt
- **错误时携带 newSessionId**：catch 块中的 `writeOutput` 携带已捕获的 `newSessionId`

## Impact

- Affected specs: `agent-execution`（ADDED：多轮循环、全局 MCP 配置、沙箱额外目录、系统上下文注入；MODIFIED：Shared Module 增加新导出）
- Affected code:
  - `container/agent-runner/src/shared.ts` — 新增 IPC 轮询函数 + 系统上下文加载函数
  - `container/agent-runner/src/claude-runner.ts` — 重构使用 shared.ts 中的新导出，删除本地重复定义
  - `container/agent-runner/src/cursor-runner.ts` — 全部对齐变更
- Depends on: `add-cursor-agent`（cursor-runner.ts 和 shared.ts 的基础结构由该变更创建）
