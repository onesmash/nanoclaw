# Design: Update Setup Skill for Process-Based Agent Execution

Date: 2026-03-07
Change: `update-setup-skill`
Status: Approved

## Context

`remove-container-isolation` 移除了 Docker/Apple Container 依赖，agent 现在以直接 Node.js 子进程方式运行。`.claude/skills/setup/SKILL.md` 及相关 `setup/` TypeScript 脚本仍包含完整的容器运行时安装步骤，需要同步清理。

## Step Structure Changes

原 Step 3（Container Runtime）整节删除，其余步骤前移重新编号：

| 新编号 | 原编号 | 内容 |
|--------|--------|------|
| Step 1 | Step 1 | Bootstrap — 不变 |
| Step 2 | Step 2 | Check Environment — 删一行 |
| Step 3 | Step 4 | Claude Authentication |
| Step 4 | Step 5 | Set Up Channels |
| Step 5 | Step 6 | Mount Allowlist |
| Step 6 | Step 7 | Start Service — 删 DOCKER_GROUP_STALE 块 |
| Step 7 | Step 8 | Verify — 不变 |

## Exact Changes

### SKILL.md

**Step 2（Check Environment）**
- 删除一行：`- Record APPLE_CONTAINER and DOCKER values for step 3`

**Step 3（Container Runtime）— 整节删除**
- 删除 `### 3a. Choose runtime` 及以下所有子节（3a-docker、3b、3c）

**步骤重新编号**
- 原 `## 4.` → `## 3.`，原 `## 5.` → `## 4.`，依此类推到 `## 8.` → `## 7.`
- 更新 Step 2 末尾 `APPLE_CONTAINER and DOCKER values for step 3` 引用（已随删除消除）

**Step 6（原 Step 7，Start Service）**
- 删除 `DOCKER_GROUP_STALE=true` 整个处理块（含 setfacl 两条命令和说明文字）

**故障排查**
- 删除 `Container agent fails` 条目，不替换

### setup/index.ts

- 删除 STEPS 注册表中 `container: () => import('./container.js'),` 一行

### setup/container.ts

- 整文件删除

### setup/environment.ts

- 删除 `appleContainer` 变量声明及其检测块（`commandExists('container')` 分支）
- 删除 `docker` 变量声明及其检测块（`commandExists('docker')` + `execSync('docker info')` 分支）
- 从 `emitStatus('CHECK_ENVIRONMENT', {...})` 调用中移除 `APPLE_CONTAINER` 和 `DOCKER` 两个字段
- 从 `logger.info({...})` 调用中移除 `appleContainer` 和 `docker` 两个字段

## Non-Changes

- `setup/verify.ts`：不涉及容器，无需改动
- `setup/service.ts`：`DOCKER_GROUP_STALE` 字段由此文件发出，需随 SKILL.md 同步——service.ts 本身保留该字段（仍有可能在其他场景有用），只删除 SKILL.md 中的处理指引
- Step 7（Verify）中 `npm run build` 修复指引保持不变（新构建流程已包含 agent-runner 编译）

## Risk

LOW — `setup/` 是独立 CLI 工具集，不被 `src/` 任何运行时代码 import。所有变更在 `setup/` 模块内自洽。
