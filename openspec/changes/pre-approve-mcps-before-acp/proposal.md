# Change: Pre-Approve MCPs Before ACP Session

## Why

`auto-approve-nanoclaw-mcp` 引入了 fire-and-forget `cursor agent mcp enable nanoclaw`，在 `syncMcpJson()` 之后以后台方式 approve nanoclaw MCP。但存在两个问题：

1. **只 approve nanoclaw（hardcoded）**：如果其他 MCP（如 peekaboo、DevHelper）的 config hash 变了，仍需手动 approve。
2. **非 blocking**：fire-and-forget 不能保证 ACP session 启动时 MCP 已经 approved；依赖 `--approve-mcps` 兜底，但 `cursor agent mcp list` 视图仍可能显示 "needs approval"。

`agent mcp list` 的输出格式清晰，可以直接解析出所有 "needs approval" 的 MCP，逐个调用 `agent mcp enable`，blocking 等待完成后再启动 ACP。

## What Changes

`cursor-runner.ts` 用 `preApproveMcps(groupDir)` 替换现有 fire-and-forget：

- 调用 `spawnSync('agent', ['mcp', 'list'], { cwd: groupDir })` 获取当前 MCP 状态
- 解析输出，找出所有 `<name>: not loaded (needs approval)` 的 MCP
- 对每个 MCP 调用 `spawnSync('agent', ['mcp', 'enable', name], { cwd: groupDir })`，errors 忽略
- **Blocking**：整个过程在 ACP session 启动前同步完成
- 使用 `agent` 而非 `cursor agent`（与现有 ACP spawn 一致，无需依赖 `cursor` wrapper）

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: Auto-Approve MCP After Config Sync)
- Affected code: `container/agent-runner/src/cursor-runner.ts`
- Depends on: `auto-approve-nanoclaw-mcp`（替换其 fire-and-forget 实现）
- Estimated latency: 通常 < 5s（1-2s list + 2-3s per enable）；若所有 MCP 已 approved 则 < 2s
