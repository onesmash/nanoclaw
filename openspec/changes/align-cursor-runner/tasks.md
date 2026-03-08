# Tasks: Align cursor-runner.ts with claude-runner.ts

前置条件：`add-cursor-agent` 实现完成（`shared.ts`、`claude-runner.ts`、`cursor-runner.ts` 基础结构已存在）。

## 1. 扩展 shared.ts：IPC 轮询函数

- [x] 1.1 将 `IPC_POLL_MS`、`shouldClose()`、`drainIpcInput()`、`waitForIpcMessage()` 从 `claude-runner.ts` 移入 `shared.ts` 并导出
- [x] 1.2 更新 `claude-runner.ts`：删除本地定义，从 `./shared.js` import
- [x] 1.3 验证：`npm run build:agent-runner` 无编译错误

## 2. 扩展 shared.ts：系统上下文加载

- [x] 2.1 在 `shared.ts` 新增 `SystemContext` 接口和 `loadSystemContext(containerInput)` 函数（读取 identity、global CLAUDE.md、BOOTSTRAP.md、TOOLS.md、extraDirs）
- [x] 2.2 在 `shared.ts` 新增 `applyScheduledTaskPrefix(prompt, isScheduledTask?)` 函数
- [x] 2.3 重构 `claude-runner.ts` 中的 `runQuery`：删除本地文件读取逻辑，改为调用 `loadSystemContext()` 和 `applyScheduledTaskPrefix()`
- [x] 2.4 验证：`npm run build:agent-runner` 无编译错误，claude-runner 行为不变

## 3. 修复 cursor-runner.ts spawn args bug

- [x] 3.1 将 `-p <prompt>` 改为位置参数（prompt 作为第一个 arg）+ `--print` 作为独立布尔标志

## 4. cursor-runner.ts：全局 MCP 配置管理

- [x] 4.1 新增常量 `GLOBAL_MCP_PATH = path.join(os.homedir(), '.cursor', 'mcp.json')`
- [x] 4.2 重构 `writeMcpConfig` → `writeConfigs`：写入前备份 `~/.cursor/mcp.json` 原内容
- [x] 4.3 新增 `cleanupConfigs()`：agent 退出后恢复原内容或 unlink
- [x] 4.4 在 `main()` 中用 `try/finally` 包裹 spawn，finally 调用 `cleanupConfigs()`

## 5. cursor-runner.ts：sandbox.json 额外目录

- [x] 5.1 在 `writeConfigs` 中读取 `NANOCLAW_EXTRA_DIR` 下子目录，写入 `<groupDir>/.cursor/sandbox.json` 的 `additionalReadwritePaths`

## 6. cursor-runner.ts：启动流程对齐

- [x] 6.1 将 `containerInput.secrets` 合并到 spawn 的 `env` 选项
- [x] 6.2 启动时 unlink close sentinel（`IPC_INPUT_CLOSE_SENTINEL`）
- [x] 6.3 启动时调用 `drainIpcInput()` 把积压消息追加到初始 prompt
- [x] 6.4 调用 `loadSystemContext()` + `applyScheduledTaskPrefix()` 构建最终 prompt，系统上下文前置
- [x] 6.5 catch 块中的 `writeOutput` 携带已捕获的 `newSessionId`

## 7. cursor-runner.ts：多轮 IPC 对话循环

- [x] 7.1 将 spawn 逻辑提取为 `spawnAgent(prompt, sessionId, spawnEnv)` 函数，返回 `{ newSessionId }`
- [x] 7.2 在 `main()` 中实现 while 循环：spawn 完成后调用 `waitForIpcMessage()`，收到消息则重新 spawn（带 `--resume <sessionId>`），收到 null（close sentinel）则退出
- [x] 7.3 验证：`npm run build:agent-runner` 无编译错误

## 8. 日志计数

- [x] 8.1 在 `cursor-runner.ts` 的 `handleEvent` 中添加 `messageCount` / `resultCount` 计数器，格式与 `claude-runner.ts` 一致
