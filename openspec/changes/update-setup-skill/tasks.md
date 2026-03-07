# Tasks: Update Setup Skill for Process-Based Agent Execution

## 1. Update SKILL.md

- [ ] 1.1 Step 2 (Check Environment)：删除"Record APPLE_CONTAINER and DOCKER values for step 3"这一行
- [ ] 1.2 删除完整的 Step 3（Container Runtime）：包括 3a（Choose runtime）、3a-docker（Install Docker）、3b（Apple Container conversion gate）、3c（Build and test）的全部内容
- [ ] 1.3 将原步骤 4→3、5→4、6→5、7→6、8→7 重新编号（包括标题和步骤内部引用）
- [ ] 1.4 新 Step 6（Start Service）：删除 `DOCKER_GROUP_STALE=true` 的全部处理块（`setfacl`、socket-acl systemd 配置共约 15 行）
- [ ] 1.5 故障排查：将"Container agent fails"改为"Agent process fails"，移除关于 Docker daemon / Apple Container 的说明，将 `container-*.log` 更新为 `process-*.log`
- [ ] 1.6 验证：SKILL.md 中无 `docker`、`container`（大小写不敏感）等词，除非是描述性上下文说明（如频道名）

## 2. Clean Up Setup Scripts

- [ ] 2.1 删除 `setup/container.ts`
- [ ] 2.2 修改 `setup/index.ts`：从 `STEPS` 对象中删除 `container: () => import('./container.js')` 这一行
- [ ] 2.3 修改 `setup/environment.ts`：删除 Docker 检测逻辑（`commandExists('docker')`、`execSync('docker info', ...)` 及 `docker` 变量）
- [ ] 2.4 修改 `setup/environment.ts`：删除 Apple Container 检测逻辑（`commandExists('container')` 及 `appleContainer` 变量）
- [ ] 2.5 修改 `setup/environment.ts`：从 `emitStatus` 调用中删除 `APPLE_CONTAINER` 和 `DOCKER` 字段
- [ ] 2.6 验证：`npm run typecheck` 无错误（无悬空引用已删除文件的 import）

## 3. Verify

- [ ] 3.1 验证：`npm test` 全部通过（`setup/environment.test.ts` 不再断言 Docker/Apple Container 字段）
- [ ] 3.2 验证：运行 `npx tsx setup/index.ts --step container` 输出 "Unknown step: container"
- [ ] 3.3 验证：运行 `npx tsx setup/index.ts --step environment`，状态块不含 `DOCKER`/`APPLE_CONTAINER` 字段
