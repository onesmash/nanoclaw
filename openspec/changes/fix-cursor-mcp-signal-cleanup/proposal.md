# Change: Fix cursor-runner MCP cleanup on signal termination

## Why

`cursor-runner.ts` 在 `finally` 块中调用 `cleanupConfigs()` 恢复 `~/.cursor/mcp.json`，但当进程收到 SIGTERM 或 SIGINT 信号时，Node.js 直接终止进程，异步 `main()` 的 `finally` 块不会执行，导致 nanoclaw MCP 配置残留在 `~/.cursor/mcp.json` 中，影响用户本机其他 Cursor 窗口。

## What Changes

- 在 `cursor-runner.ts` 中注册 `SIGTERM` 和 `SIGINT` 信号处理器，在退出前同步调用 `cleanupConfigs()`
- 补充 `process.on('exit', cleanupConfigs)` 作为安全兜底，覆盖 `process.exit()` 直接调用等同步退出场景

## Impact

- Affected specs: `agent-execution`（MODIFIED：Cursor Runner Global MCP Config——新增信号清理场景）
- Affected code: `container/agent-runner/src/cursor-runner.ts`（新增约 10 行）
