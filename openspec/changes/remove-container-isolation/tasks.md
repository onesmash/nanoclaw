# Tasks: Remove Container Isolation Layer

每步独立可验证，按顺序完成。

## 1. Build Integration

- [x] 1.1 在 `package.json` 中添加 `build:agent-runner` 脚本：`cd container/agent-runner && npm install && tsc`
- [x] 1.2 修改 `build` 脚本为 `npm run build:agent-runner && tsc`
- [x] 1.3 修改 `dev` 脚本为 `npm run build:agent-runner && tsx watch src/index.ts`
- [x] 1.4 验证：运行 `npm run build`，确认 `container/agent-runner/dist/index.js` 生成且主项目编译成功

## 2. Agent-Runner Path Variables

- [x] 2.1 修改 `container/agent-runner/src/index.ts`：将 6 处硬编码 `/workspace/` 路径替换为带回退的 env var（`process.env.NANOCLAW_IPC_DIR ?? '/workspace/ipc'` 等）
- [x] 2.2 修改 `container/agent-runner/src/ipc-mcp-stdio.ts`：替换 1 处 `/workspace/ipc` 硬编码路径
- [x] 2.3 验证：在没有 `NANOCLAW_*` 环境变量时，路径回退为 `/workspace/...`

## 3. Create process-runner.ts

- [x] 3.1 新建 `src/process-runner.ts`，以 `src/container-runner.ts` 为基础进行修改
- [x] 3.2 移除 `buildVolumeMounts()` 和 `buildContainerArgs()` 函数
- [x] 3.3 新增 `buildEnv(group, input)` 函数，构建 `NANOCLAW_*`、`HOME`、`TZ` 环境变量对象
- [x] 3.4 将 `spawn(CONTAINER_RUNTIME_BIN, containerArgs)` 替换为 `spawn('node', [AGENT_RUNNER_PATH], { env: buildEnv(...) })`
- [x] 3.5 定义 `AGENT_RUNNER_PATH = path.join(process.cwd(), 'container/agent-runner/dist/index.js')`
- [x] 3.6 保持导出符号不变（`runContainerAgent`、`ContainerInput`、`ContainerOutput`、`writeTasksSnapshot`、`writeGroupsSnapshot`、`AvailableGroup`）
- [x] 3.7 验证：TypeScript 编译 `src/process-runner.ts` 无错误

## 4. Update src/index.ts

- [x] 4.1 将 `import ... from './container-runner.js'` 改为 `'./process-runner.js'`
- [x] 4.2 移除 `import { ensureContainerRuntimeRunning, cleanupOrphans } from './container-runtime.js'`
- [x] 4.3 删除 `ensureContainerSystemRunning()` 函数
- [x] 4.4 移除 `main()` 中对 `ensureContainerSystemRunning()` 的调用
- [x] 4.5 验证：`npm run typecheck` 无错误

## 5. Update Remaining Imports

- [x] 5.1 修改 `src/task-scheduler.ts`：`./container-runner.js` → `./process-runner.js`
- [x] 5.2 修改 `src/ipc.ts`：`AvailableGroup` 导入来源改为 `./process-runner.js`
- [x] 5.3 修改 `src/group-queue.ts`：更新日志字段语义注释，`detachedContainers` → `detachedProcesses`（仅日志字符串，不影响接口）

## 6. Delete Container Runtime and Build Files

- [x] 6.1 删除 `src/container-runtime.ts`
- [x] 6.2 删除 `src/container-runtime.test.ts`
- [x] 6.3 删除 `container/Dockerfile`
- [x] 6.4 删除 `container/build.sh`
- [x] 6.5 验证：`npm run build` 和 `npm test` 均无引用已删除文件的错误

## 7. Update Test File

- [x] 7.1 新建 `src/process-runner.test.ts`，替代 `src/container-runner.test.ts`
- [x] 7.2 更新 spawn 断言：验证 `spawn('node', [AGENT_RUNNER_PATH], ...)` 而非 `spawn('docker', ...)`
- [x] 7.3 验证：`npm test` 全部通过（313 tests passed）

## 8. End-to-End Verification

- [x] 8.1 `npx tsc --noEmit` 零错误
- [x] 8.2 `npm test` 全部 313 个测试通过
- [ ] 8.3 启动服务（`npm run dev`），确认无 Docker 相关错误日志（手动验证）
- [ ] 8.4 发送一条测试消息，确认 agent-runner 子进程正常启动并返回响应（手动验证）
