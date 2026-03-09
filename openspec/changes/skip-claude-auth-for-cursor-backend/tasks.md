# Implementation Tasks

## 1. auth-check 模块扩展
- [x] 1.1 在 `src/auth-check.ts` 中新增 `checkCursorCli(): Promise<boolean>`，执行 `agent --version`，成功返回 true，失败返回 false

## 2. 启动逻辑修改
- [x] 2.1 在 `src/index.ts` 中导入 `AGENT_BACKEND` 与 `checkCursorCli`
- [x] 2.2 在 `main()` 启动检查处：当 `AGENT_BACKEND === 'cursor'` 时，调用 `checkCursorCli()`，不可用时输出错误并 `process.exit(1)`
- [x] 2.3 当 `AGENT_BACKEND === 'cursor'` 且 `checkCursorCli()` 成功时，记录日志 "Using Cursor agent CLI (AGENT_BACKEND=cursor)"，跳过 `checkAuthentication()`
- [x] 2.4 当 `AGENT_BACKEND !== 'cursor'` 时，保持原有 `checkAuthentication()` 逻辑不变

## 3. 测试与验证
- [x] 3.1 单元测试：为 `checkCursorCli` 添加测试（可 mock `exec`，或跳过若难以 mock）
- [x] 3.2 手动验证：`AGENT_BACKEND=cursor` 且 agent 可用时，启动成功
- [x] 3.3 手动验证：`AGENT_BACKEND=cursor` 且 agent 不可用时，启动失败并显示正确提示
- [x] 3.4 手动验证：`AGENT_BACKEND=claude` 或未设置时，行为与变更前完全一致
- [x] 3.5 运行 `npm run build` 和 `npm test`，确保无回归
