# Task Retry & Failure Alert Design

## Goal

为调度层（`task-scheduler.ts`）加入：
1. 瞬时错误自动重试（指数退避）
2. 每次失败通知用户
3. 超限后停止重试

## 设计决策

| 问题 | 决策 |
|------|------|
| 重试层级 | 调度层（`task-scheduler.ts`），不在 agent runner 内部 |
| 哪些错误重试 | 所有错误 |
| 退避策略 | `min(naturalNext, backoffNext)`，快速重试但不超过自然调度时间 |
| 超限后循环任务 | 恢复自然调度，重置计数 |
| 超限后单次任务 | `status: 'paused'`（复用现有状态，零 schema 改动） |
| 通知渠道 | `task.chat_jid`（哪个群的任务失败通知哪个群） |
| 通知时机 | 每次失败都通知 |

## 数据层变更

`scheduled_tasks` 加一个字段（`ALTER TABLE` migration）：

```sql
consecutive_errors INTEGER DEFAULT 0
```

- 任务成功 → 重置为 0
- 任务失败 → 递增
- 超限后循环任务 → 重置为 0，恢复 `computeNextRun(task)`
- 超限后单次任务 → 保持当前值，`status: 'paused'`

`ScheduledTask` 类型加 `consecutive_errors: number`。

## 重试逻辑

```typescript
const RETRY_BACKOFF_MS = [30_000, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const MAX_RETRIES = 3;

if (error) {
  const attempt = (task.consecutive_errors ?? 0) + 1;

  if (attempt < MAX_RETRIES) {
    // 未超限：min(naturalNext, backoffNext) 快速重试
    const backoff = RETRY_BACKOFF_MS[attempt - 1];
    const backoffNext = Date.now() + backoff;
    const naturalNext = computeNextRun(task);
    const nextRun = naturalNext
      ? new Date(Math.min(new Date(naturalNext).getTime(), backoffNext)).toISOString()
      : new Date(backoffNext).toISOString();
    updateTask(task.id, { consecutive_errors: attempt, next_run: nextRun });
  } else {
    // 超限
    if (task.schedule_type === 'once') {
      updateTask(task.id, { status: 'paused', consecutive_errors: attempt });
    } else {
      updateTask(task.id, { consecutive_errors: 0, next_run: computeNextRun(task) });
    }
  }
  // 通知用户
  await notifyTaskFailure(task, attempt, error, deps);
} else {
  updateTask(task.id, { consecutive_errors: 0 });
  updateTaskAfterRun(task.id, computeNextRun(task), result?.slice(0, 200) ?? 'Completed');
}
```

## 通知内容

**重试中（attempt < MAX_RETRIES）：**
```
⚠️ 任务「{任务名/prompt前50字}」第 {attempt}/{MAX_RETRIES} 次失败
错误：{error.slice(0, 200)}
将在 {backoff秒} 后重试。
```

**超限（循环任务）：**
```
❌ 任务「...」已连续失败 {MAX_RETRIES} 次，停止重试。
错误：{error.slice(0, 200)}
下次将按原计划在 {naturalNext} 执行。
如需立即重试，请告诉我。
```

**超限（单次任务，已 paused）：**
```
❌ 任务「...」已连续失败 {MAX_RETRIES} 次，任务已暂停。
错误：{error.slice(0, 200)}
如需重新执行，请告诉我。
```

## 涉及文件

- `src/db.ts` — 加 `consecutive_errors` migration 和字段
- `src/types.ts` — `ScheduledTask` 加 `consecutive_errors: number`
- `src/task-scheduler.ts` — 重试逻辑 + `notifyTaskFailure` 函数

## 不涉及

- `cursor-runner.ts` / `claude-runner.ts` — agent runner 内部不变
- 调度器循环逻辑不变
- `GroupQueue` 不变
