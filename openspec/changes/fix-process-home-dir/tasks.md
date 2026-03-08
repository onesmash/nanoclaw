## 1. process-runner.ts — 移除 HOME override

- [x] 1.1 从 `buildEnv()` 中删除 `const homeDir = path.join(DATA_DIR, 'sessions', group.folder)` 声明
- [x] 1.2 从 `buildEnv()` 中删除 `HOME: homeDir` 环境变量赋值
- [x] 1.3 从顶部 import 中移除 `DATA_DIR`（确认无其他引用）

## 2. process-runner.ts — 调整 prepareGroupDirs 目标路径

- [x] 2.1 将 `groupSessionsDir` 的路径从 `path.join(DATA_DIR, 'sessions', group.folder, '.claude')` 改为 `path.join(groupDir, '.claude')`
- [x] 2.2 确认 `settings.json` 和 skills 的写入路径随之正确更新（无需额外修改，复用 `groupSessionsDir` 变量即可）

## 3. cursor-runner.ts — 清理冗余 HOME

- [x] 3.1 从 `spawnEnv` 中移除 `HOME: realHome`（process.env.HOME 已是真实 home，无需显式赋值）
- [x] 3.2 若 `REAL_HOME` 常量不再被任何其他地方使用，一并移除（`REAL_HOME` 仍用于 globalCursorDir/GLOBAL_MCP_PATH，保留；`realHome` 局部变量已移除）

## 4. 验证

- [x] 4.1 运行 `npm run typecheck` 确认无 TypeScript 错误
- [x] 4.2 运行 `npm test` 确认已有测试通过
