# Change: Write NANOCLAW_CHAT_JID into mcp.json env, Refresh per Session

## Why

`cursor-mcp-jid-via-env` 将 `NANOCLAW_CHAT_JID` 从 `mcp.json` 的 `env` 块移除，假设 MCP server 会从父进程 env 继承该值。但实测发现 Cursor 对 `mcp.json` 里有 `env` 块时用显式 env **替换**（而非合并）父进程 env；没有 `env` 块时用**干净 env** 启动 MCP server。两种情况下 `NANOCLAW_CHAT_JID` 均无法通过父进程继承传入。

结果：MCP server 读不到正确 JID，`schedule_task` 等工具写入 IPC 文件时 `targetJid` 为旧渠道的 JID（或 undefined），导致 task 被路由到错误渠道。

## What Changes

`syncMcpJson()` 在 `mcp.json` 的 `nanoclaw.env` 块中**新增 `NANOCLAW_CHAT_JID: containerInput.chatJid`**，每次 cursor-runner 启动时写入当前会话的 JID。

竞态分析：GroupQueue 保证同一 `group_folder` 的消息串行处理，不存在两个 cursor-runner 同时写 `mcp.json` 的情况。

## Impact

- Affected specs: `cursor-agent-execution`（MODIFIED: Workspace MCP Config Sync requirement）
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts`（`syncMcpJson` 的 `env` 对象新增 `NANOCLAW_CHAT_JID`）
- Depends on: `cursor-mcp-jid-via-env`（已部署）
- Risk: LOW
