# Tasks: Add Cursor CLI Agent Backend

每步独立可验证，按顺序完成。

## 1. Config

- [ ] 1.1 在 `src/config.ts` 新增 `export const AGENT_BACKEND = process.env.AGENT_BACKEND ?? 'claude'`
- [ ] 1.2 在 `src/process-runner.ts` 的 `buildEnv()` 中将 `AGENT_BACKEND` 传入子进程环境变量
- [ ] 1.3 验证：`npm run typecheck` 无错误

## 2. Extract shared.ts

- [ ] 2.1 新建 `container/agent-runner/src/shared.ts`，从 `index.ts` 提取：
  - `ContainerInput` / `ContainerOutput` 接口
  - `readStdin()` 函数
  - `OUTPUT_START_MARKER` / `OUTPUT_END_MARKER` 常量
  - `writeOutput()` 函数
- [ ] 2.2 验证：`npm run build:agent-runner` 无编译错误

## 3. Create claude-runner.ts

- [ ] 3.1 新建 `container/agent-runner/src/claude-runner.ts`，将 `index.ts` 中除入口以外的全部逻辑移入（`MessageStream`、`runQuery`、`main` 等）
- [ ] 3.2 改用 `shared.ts` 中的公共类型和工具（import from `./shared.js`）
- [ ] 3.3 导出 `main()` 函数
- [ ] 3.4 验证：`npm run build:agent-runner` 无编译错误

## 4. Refactor index.ts to dispatcher

- [ ] 4.1 精简 `index.ts` 为分发器：读取 `AGENT_BACKEND` 环境变量，动态 import 并调用对应 runner 的 `main()`
- [ ] 4.2 验证：`npm run build:agent-runner` 无编译错误，现有行为不变

## 5. Create cursor-runner.ts

- [ ] 5.1 新建 `container/agent-runner/src/cursor-runner.ts`，导出 `main()` 函数
- [ ] 5.2 读取 `ContainerInput` from stdin（复用 `shared.ts` 的 `readStdin`）
- [ ] 5.3 向群组 workspace 的 `.cursor/mcp.json` 写入 MCP server 配置，引用 `dist/ipc-mcp-stdio.js`，携带 `NANOCLAW_IPC_DIR`、`NANOCLAW_CHAT_JID`、`NANOCLAW_GROUP_FOLDER`、`NANOCLAW_IS_MAIN` 环境变量
- [ ] 5.4 实现 spawn：`agent -p <prompt> --output-format stream-json --stream-partial-output --force --trust --approve-mcps --workspace <groupDir> [--resume <sessionId>]`
- [ ] 5.5 实现 NDJSON 逐行解析并转译为 IPC markers（复用 `shared.ts` 的 `writeOutput`）：
  - `system init` → 取 `session_id` 暂存
  - `assistant` → 流式中间 `writeOutput({ status:'success', result: text })`
  - `result` success → `writeOutput({ status:'success', result, newSessionId })`
  - `result` error → `writeOutput({ status:'error', error })`
  - `thinking`、`tool_call` → 忽略
- [ ] 5.6 验证：`npm run build:agent-runner` 无编译错误

## 6. Tests

- [ ] 6.1 更新 `container/agent-runner/src/` 相关测试（如有），确认 `shared.ts` 导入路径正确
- [ ] 6.2 新建 `cursor-runner` 测试：验证 spawn 参数、NDJSON 解析、`writeOutput` 调用
- [ ] 6.3 验证：`npm test` 全部通过

## 7. End-to-End Verification

- [ ] 7.1 `npm run build` 成功
- [ ] 7.2 在 `.env` 设置 `AGENT_BACKEND=cursor`，`npm run dev` 启动无错误
- [ ] 7.3 发送测试消息，确认 `cursor-runner` 运行，日志显示 `session_id`
- [ ] 7.4 发送第二条消息，确认 `--resume <session_id>` 被传入
- [ ] 7.5 恢复 `AGENT_BACKEND=claude`，确认原 Claude 路径行为不变
