# Change: Update Setup Skill for Process-Based Agent Execution

## Why

`remove-container-isolation` 移除了 Docker/Apple Container 依赖，agent 现在以直接 Node.js 子进程方式运行。但 `.claude/skills/setup/SKILL.md`（以及相关的 `setup/` TypeScript 脚本）仍然包含完整的容器运行时安装、镜像构建、运行时选择等步骤，这些指令现在是错误的，会误导安装过程。

## What Changes

- **BREAKING** 移除 SKILL.md 中的 Step 3（Container Runtime）全部内容：运行时选择、Docker 安装、Apple Container 转换检查、镜像构建验证
- 删除 SKILL.md Step 2 中"Record APPLE_CONTAINER and DOCKER values for step 3"这一行
- 删除 SKILL.md Step 7（Start Service）中 `DOCKER_GROUP_STALE=true` 的全部处理逻辑
- 将 SKILL.md 步骤重新编号（原 4→3、5→4、6→5、7→6、8→7）
- 删除 SKILL.md 故障排查区块中"Container agent fails"条目（不替换）
- 删除 `setup/container.ts`（死代码：`Dockerfile` 和 `build.sh` 已删除）
- 更新 `setup/index.ts`：从 `STEPS` 注册表移除 `container` 条目
- 清理 `setup/environment.ts`：移除 Docker 和 Apple Container 检测逻辑及对应状态字段

## Impact

- Affected specs: `setup-workflow`（新建）
- Affected code:
  - `.claude/skills/setup/SKILL.md` → 主要目标，移除容器运行时步骤
  - `setup/container.ts` → 删除
  - `setup/index.ts` → 移除 container 步骤注册
  - `setup/environment.ts` → 移除 Docker/Apple Container 检测字段
