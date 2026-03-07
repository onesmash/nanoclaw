# Change: Remove Container Isolation Layer

## Why

NanoClaw 目前要求 Docker（或 Apple Container）作为运行时依赖，将每个 agent 隔离在容器中执行。对于个人使用场景，Claude Code SDK 自带的权限控制已足够，OS 级别的容器隔离引入了额外的依赖和运维复杂度。移除容器层可以简化架构、消除 Docker 依赖，同时保持完整的 IPC 协议不变。

## What Changes

- **BREAKING** 移除 Docker/Apple Container 运行时依赖，agent 改为以直接 Node.js 子进程方式运行
- 新建 `src/process-runner.ts`，替代 `src/container-runner.ts`；spawn 由 `docker run` 改为 `node agent-runner/dist/index.js`
- 删除 `src/container-runtime.ts` 和 `src/container-runtime.test.ts`（Docker 生命周期管理）
- `container/agent-runner/` 路径解析从硬编码 `/workspace/` 改为 `NANOCLAW_*` 环境变量（保留 `/workspace/` 回退，保持容器兼容性）
- `package.json` 构建脚本增加 `build:agent-runner` 步骤，确保主构建流程包含 agent-runner 编译
- `src/index.ts` 移除 `ensureContainerSystemRunning()` 调用
- 更新 `src/ipc.ts`、`src/task-scheduler.ts`、`src/group-queue.ts` 的导入引用
- 移除每群组 agent-runner 源码定制机制（无现有群组使用此功能）
- 删除 `container/Dockerfile` 和 `container/build.sh`（不再需要容器镜像构建）

## Impact

- Affected specs: `agent-execution`（新建）
- Affected code:
  - `src/container-runner.ts` → 替换为 `src/process-runner.ts`
  - `src/container-runtime.ts` → 删除
  - `src/container-runtime.test.ts` → 删除
  - `src/container-runner.test.ts` → 更新
  - `src/index.ts` → 移除容器系统初始化
  - `src/task-scheduler.ts` → 更新导入
  - `src/ipc.ts` → 更新导入
  - `src/group-queue.ts` → 更新日志字段语义
  - `container/agent-runner/src/index.ts` → 路径改用环境变量
  - `container/agent-runner/src/ipc-mcp-stdio.ts` → 路径改用环境变量
  - `package.json` → 增加构建步骤
