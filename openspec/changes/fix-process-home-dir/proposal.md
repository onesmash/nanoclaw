# Change: Fix Process Mode HOME Directory Handling

## Why

`process-runner.ts` 的 `buildEnv()` 将 `HOME` 设为 `data/sessions/{group}/`，原意是给 Claude Code 提供隔离的 HOME 目录（存放 `.claude/settings.json`、skills 等）。但在 process 模式下，这个 HOME 覆盖是多余且有害的：

- **cursor-runner** 在 spawn agent 前已经将 `HOME` 覆盖回真实 home（`os.userInfo().homedir`），意味着 Cursor CLI 从未使用过 `data/sessions/` 目录；`process-runner` 的 HOME 设置对它完全无效。
- **claude-runner** 直接调用 SDK（不 spawn 子进程），所以 HOME 对 SDK 本身无直接影响；但将 HOME 改掉会影响当前进程的其他路径解析，并可能导致凭证访问问题。
- `prepareGroupDirs()` 将 `settings.json` 和 skills 写到 `data/sessions/{group}/.claude/`，但 claude-runner 用 `settingSources: ['project', 'user']`，`'project'` 读的是 `NANOCLAW_GROUP_DIR`（即 `groups/{name}/`）下的 `.claude/`——写到 sessions dir 的文件从未被读取。

正确做法：不修改 HOME，将所有需要预置的配置直接写到 `groups/{name}/.claude/`（agent 的 workspace），让 claude-runner 的 project-level settings 机制自然生效。

## What Changes

- `src/process-runner.ts` `buildEnv()`：移除 `HOME: homeDir` 一行（连同 `const homeDir` 声明和 `DATA_DIR` import）
- `src/process-runner.ts` `prepareGroupDirs()`：将 `.claude/` 目录从 `data/sessions/{group}/.claude/` 改为 `groups/{name}/.claude/`（即 `groupDir/.claude/`）
- `container/agent-runner/src/cursor-runner.ts` `spawnEnv`：移除冗余的 `HOME: realHome`（process.env.HOME 已是真实 home）

## Impact

- Affected specs: `agent-execution`（MODIFIED: Process Environment Setup）
- Affected code:
  - `src/process-runner.ts` — 移除 HOME override，调整 prepareGroupDirs 目标路径
  - `container/agent-runner/src/cursor-runner.ts` — 移除冗余 HOME 赋值

## Notes

`data/sessions/` 目录本身不删除（存有历史数据），只是不再向其中写入新配置。
