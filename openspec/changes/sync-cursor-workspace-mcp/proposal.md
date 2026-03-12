# Change: Sync ipc-mcp-stdio to workspace mcp.json in cursor-runner

## Why

`cursor-runner.ts` 当前仅通过 ACP 协议的 `newSession`/`loadSession` 参数传递 MCP 配置，但该方式不可靠，导致 Cursor agent 无法稳定加载 nanoclaw MCP server。写入 workspace `.cursor/mcp.json` 是 Cursor 原生支持的 MCP 配置方式，可作为可靠的补充机制。

## What Changes

- `cursor-runner.ts` 在 spawn `agent acp` 前，将 `nanoclaw` MCP server 配置合并写入 `{groupDir}/.cursor/mcp.json`
- 写入采用 merge 策略：只更新 `mcpServers.nanoclaw` 字段，不影响文件中其他已有配置
- ACP `newSession`/`loadSession` 中的 `mcpServers` 传参保持不变（belt & suspenders）

## Impact

- Affected specs: `cursor-agent-execution`（ADDED：Workspace MCP Config Sync）
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — 新增 `syncMcpJson()` 函数，在 `main()` 中 spawn 前调用
- Depends on: `use-cursor-acp`（cursor-runner.ts 的 ACP 架构）
