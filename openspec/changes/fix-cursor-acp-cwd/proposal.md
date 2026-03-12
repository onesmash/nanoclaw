# Change: Fix cursor-runner agent acp spawn missing cwd

## Why

`cursor-runner.ts` 在 spawn `agent acp` 时未设置 `cwd`，导致 agent 进程继承 nanoclaw 主进程的工作目录（project root），而非 group 目录。Cursor agent 以进程 CWD 作为 workspace，因此 workspace 错误地指向 project root 而不是 `{groupDir}`。

## What Changes

- `cursor-runner.ts` 的 `spawn('agent', ['acp'], ...)` 调用中增加 `cwd: groupDir`

## Impact

- Affected specs: `cursor-agent-execution`（ADDED：Spawn Working Directory）
- Affected code:
  - `container/agent-runner/src/cursor-runner.ts` — spawn 选项增加 `cwd`
- Depends on: `use-cursor-acp`
