# Change: Auto-init HEARTBEAT.md and Stop Git Tracking

## Why

`groups/main/HEARTBEAT.md` 是用户私有的运行时文件，内容因人而异，不应随代码库版本化。当前 `.gitignore` 中的 `!groups/main/HEARTBEAT.md` 强制追踪该文件，导致每次修改都出现在 `git status` 中——产生噪音且暴露用户的私有配置。

同时，若用户在全新环境 clone 项目，HEARTBEAT.md 不存在，心跳调度器会跳过（`ENOENT` 不报错），但用户缺少模版引导，不知道如何配置任务。

## What Changes

1. **`.gitignore`**：移除 `!groups/main/HEARTBEAT.md`（停止强制追踪），改为被 `groups/main/*` 规则排除（已有）
2. **`setup/register.ts`**：main group 注册时，若 `HEARTBEAT.md` 不存在，从内嵌模版内容写入该文件
3. **模版内容**：保持与现有文件一致的注释风格，提示用户保持文件空以跳过心跳、或在下方添加任务

## Impact

- Affected specs: `heartbeat`（MODIFIED）
- Affected code:
  - `.gitignore` — 移除 `!groups/main/HEARTBEAT.md` 一行
  - `setup/register.ts` — 在 heartbeat 任务创建逻辑后，检查并写入 HEARTBEAT.md
- No schema changes, no new dependencies
