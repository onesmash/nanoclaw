## 1. SKILL.md 更新

- [x] 1.1 删除 Step 3（Container Runtime）整节（`### 3a. Choose runtime` 至 `### 3c. Build and test` 全部内容）
- [x] 1.2 删除 Step 2 末尾一行：`- Record APPLE_CONTAINER and DOCKER values for step 3`
- [x] 1.3 将剩余步骤重新编号：原 4→3、5→4、6→5、7→6、8→7（含标题和内部交叉引用）
- [x] 1.4 删除 Step 6（原 Step 7）中 `DOCKER_GROUP_STALE=true` 整个处理块
- [x] 1.5 删除故障排查区块中 `Container agent fails` 条目

## 2. setup/index.ts 更新

- [x] 2.1 从 `STEPS` 注册表删除 `container: () => import('./container.js'),` 一行

## 3. setup/container.ts 删除

- [x] 3.1 删除 `setup/container.ts` 整文件

## 4. setup/environment.ts 清理

- [x] 4.1 删除 `appleContainer` 变量声明及其 `commandExists('container')` 检测块
- [x] 4.2 删除 `docker` 变量声明及其 `commandExists('docker')` + `execSync('docker info')` 检测块
- [x] 4.3 从 `emitStatus('CHECK_ENVIRONMENT', {...})` 调用中移除 `APPLE_CONTAINER` 和 `DOCKER` 字段
- [x] 4.4 从 `logger.info({...})` 调用中移除 `appleContainer` 和 `docker` 字段
- [x] 4.5 移除 `commandExists` 的 import（如不再被其他代码使用）
