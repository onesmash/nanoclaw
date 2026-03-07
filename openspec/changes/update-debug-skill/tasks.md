## 1. SKILL.md 更新

- [x] 1.1 更新 frontmatter description：移除 "container fails"，改为 "agent process fails"
- [x] 1.2 重写 Architecture Overview：`container-runner.ts` → `process-runner.ts`，Docker volume mounts → `NANOCLAW_*` 环境变量，`HOME` 指向 `data/sessions/{folder}/`
- [x] 1.3 更新 Log Locations 表：`container-*.log` → `process-*.log`，路径改为 `groups/{folder}/logs/process-*.log`
- [x] 1.4 将 Common Issue #1 标题改为 "Process agent exited with code 1"，日志检查路径改为 `groups/{folder}/logs/process-*.log`
- [x] 1.5 删除 Common Issue #2 "Environment Variables Not Passing"（Docker `-i` flag 问题）
- [x] 1.6 删除 Common Issue #3 "Mount Issues"
- [x] 1.7 删除 Common Issue #4 "Permission Issues"（含 `node` user/uid 1000 内容）
- [x] 1.8 删除 Common Issue #1 中的 "Root User Restriction" 子问题
- [x] 1.9 更新 Common Issue（原 #5）"Session Not Resuming"：移除 mount path 检查，改为验证 `buildEnv` 中 `HOME` 环境变量设置
- [x] 1.10 将 "Manual Container Testing" 章节替换为 "Manual Process Testing"，提供 `node container/agent-runner/dist/index.js` + 环境变量 + stdin JSON 的测试命令
- [x] 1.11 删除 "Checking Container Image" 章节（docker images / docker run --entrypoint）
- [x] 1.12 新增 "Checking Agent Runner Build" 章节（检查 `container/agent-runner/dist/index.js` 是否存在，`node --version`）
- [x] 1.13 更新 "Rebuilding After Changes"：移除 `./container/build.sh` 和 `docker builder prune`，保留 `npm run build`
- [x] 1.14 更新 IPC Debugging 路径：`data/ipc/messages/` → `data/ipc/{groupFolder}/messages/`，`data/ipc/tasks/` → `data/ipc/{groupFolder}/tasks/`
- [x] 1.15 更新 Quick Diagnostic Script：移除 `docker info`、`docker run` 容器检查、session mount path 检查；新增 `container/agent-runner/dist/index.js` 存在性检查
