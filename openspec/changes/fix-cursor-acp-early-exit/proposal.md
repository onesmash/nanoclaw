# Change: Fix Cursor ACP Early Process Exit Not Caught

## Why

当 `agent acp` 进程在 `connection.initialize()` 完成前因网络错误（如 `ENOTFOUND api2.cursor.sh`）提前退出时，ACP SDK 内部的 NDJSON stream 会关闭，但产生的 Promise rejection **不被 `cursor-runner.ts` 的 `try-catch` 捕获**，导致：

1. Node.js 输出 `Warning: Detected unsettled top-level await`
2. 进程以 exit code 13 退出（而非规范要求的 code 1）
3. `writeOutput({ status: 'error', ... })` 未被调用，`process-runner.ts` 读不到任何输出，无法记录错误

已有规范（`use-cursor-acp` → `agent-execution` spec）已定义该场景：
> *WHEN the ACP process exits unexpectedly, THEN `writeOutput({ status: 'error' })` is called AND the process exits with code 1*

但当前实现未满足此规范：`agentProc.on('close')` 未与主执行路径竞争，早期退出绕过了 `try-catch`。

**根因证据**（来自 `groups/main/logs/`）：

```
[cursor-runner] Spawning agent acp
[cursor-runner] stderr: Error: [unavailable] getaddrinfo ENOTFOUND api2.cursor.sh
Warning: Detected unsettled top-level await at .../dist/index.js:12
```

## What Changes

- `container/agent-runner/src/cursor-runner.ts`：在 `agentProc` 启动后立即创建 `agentExited` Promise（监听 `close` 事件），并用 `Promise.race([mainFlow(), agentExited])` 替换直接 `await`，确保早期退出被 `try-catch` 捕获，触发 `writeOutput({ status: 'error' })` 和 `process.exit(1)`

无其他文件变更。

## Impact

- Affected specs: `agent-execution`（MODIFIED: 强化"Agent error"场景，明确早期退出竞争机制）
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — 约 10 行变更
- Depends on: `use-cursor-acp`（必须已应用）
