# Change: Add Task Retry & Failure Alert

## Why

调度器（`task-scheduler.ts`）目前任务失败后直接跳到下一个自然调度时间，瞬时错误（网络抖动、API 超时）会白白等待到下次调度才重试，且用户对失败毫不知情。需要加入自动重试和失败通知，提高任务可靠性和可见性。

## What Changes

- `src/db.ts`：`scheduled_tasks` 表新增 `consecutive_errors INTEGER DEFAULT 0` 字段（ALTER TABLE 迁移）
- `src/types.ts`：`ScheduledTask` 接口加 `consecutive_errors: number` 字段
- `src/task-scheduler.ts`：
  - 任务失败后指数退避重试（最多 `MAX_RETRIES = 3` 次），使用 `min(naturalNext, backoffNext)` 策略
  - 超限后：循环任务恢复自然调度并重置计数；单次任务置 `status: 'paused'`
  - 任务成功后重置 `consecutive_errors = 0`
  - 每次失败调用 `notifyTaskFailure()` 向 `task.chat_jid` 发送通知

## Retry Strategy

退避间隔（`RETRY_BACKOFF_MS`）：30s → 60s → 5min → 15min → 60min（索引由 `attempt-1` 决定）

`MAX_RETRIES = 3`：第 1、2 次失败快速重试，第 3 次失败触发超限处理。

`min(naturalNext, backoffNext)`：避免退避时间超过任务本身的自然执行时间，不延误正常调度。

## Impact

- Affected specs: `task-retry-failure`（新建）
- Affected code:
  - `src/types.ts` — `ScheduledTask` 加 `consecutive_errors` 字段
  - `src/db.ts` — schema 迁移 + `updateTask` 支持新字段
  - `src/task-scheduler.ts` — 重试逻辑 + `notifyTaskFailure` 函数
- No changes: `cursor-runner.ts`, `claude-runner.ts`, `GroupQueue`, 调度器轮询循环
