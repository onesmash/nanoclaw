# Change: Update Debug Skill for Process-Based Agent Execution

## Why

`remove-container-isolation` 将 agent 执行方式从 Docker 容器改为直接 Node.js 子进程，但 `.claude/skills/debug/SKILL.md` 仍包含大量 Docker 专属内容（`container-runner.ts`、docker 命令、容器镜像检查、挂载调试等），会误导用户排查问题。

## What Changes

- **BREAKING** 移除架构图中的 Docker/容器描述，改为 Node.js 子进程模型（`src/process-runner.ts`、`NANOCLAW_*` 环境变量、stdin secrets）
- 更新日志位置表：`container-*.log` → `process-*.log`，路径从 `data/sessions/` 而非容器挂载
- 删除 "Environment Variables Not Passing" 常见问题（Docker `-i` flag 问题，已不适用）
- 删除 "Mount Issues" 常见问题（无挂载机制）
- 删除 "Permission Issues" 常见问题（无容器用户 `node`/uid 1000）
- 删除 "Root User Restriction" 子问题
- 更新 "Session Not Resuming" 问题：挂载路径检查 → `HOME` 环境变量检查
- 将 "Manual Container Testing"（docker run 命令）替换为 "Manual Process Testing"（直接 node 子进程命令）
- 将 "Checking Container Image"（docker images）替换为 "Checking Agent Runner Build"（检查 dist 产物）
- 更新 "Rebuilding After Changes"：移除 `./container/build.sh`，保留 `npm run build`
- 更新快速诊断脚本：移除 docker 相关检查，新增 agent-runner dist 存在性检查
- 更新 IPC 调试路径：`data/ipc/messages/` → `data/ipc/{groupFolder}/messages/`

## Impact

- Affected specs: `debug-skill`（新建）
- Affected code:
  - `.claude/skills/debug/SKILL.md` → 主要目标，移除容器运行时调试内容，对齐进程模式
