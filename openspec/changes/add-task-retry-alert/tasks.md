## 1. Data Model

- [x] 1.1 `src/types.ts`: 在 `ScheduledTask` 接口加 `consecutive_errors?: number` 字段（可选，DB 默认 0）
- [x] 1.2 `src/db.ts`: 在 `createSchema()` 加 ALTER TABLE 迁移（`consecutive_errors INTEGER DEFAULT 0`）
- [x] 1.3 `src/db.ts`: 更新 `updateTask()` Pick 类型包含 `consecutive_errors` 字段及对应 `if` 分支

## 2. Retry Logic

- [x] 2.1 `src/task-scheduler.ts`: 定义常量 `RETRY_BACKOFF_MS` 和 `MAX_RETRIES = 3`
- [x] 2.2 `src/task-scheduler.ts`: `runTask()` 失败路径：计算 `attempt`，判断是否超限
- [x] 2.3 `src/task-scheduler.ts`: 未超限时：计算 `backoffNext` 和 `naturalNext`，取 `min`，`updateTask` 写入新 `next_run` 和 `consecutive_errors`
- [x] 2.4 `src/task-scheduler.ts`: 超限且循环任务：`updateTask({ consecutive_errors: 0, next_run: computeNextRun(task) })`
- [x] 2.5 `src/task-scheduler.ts`: 超限且单次任务：`updateTask({ status: 'paused', consecutive_errors: attempt })`
- [x] 2.6 `src/task-scheduler.ts`: 成功路径：`updateTask({ consecutive_errors: 0 })`，后调 `updateTaskAfterRun`

## 3. Failure Notification

- [x] 3.1 `src/task-scheduler.ts`: 提取 `notifyTaskFailure(task, attempt, error, deps)` 函数
- [x] 3.2 `src/task-scheduler.ts`: 通知内容覆盖三种场景（重试中 / 超限循环 / 超限单次）
- [x] 3.3 `src/task-scheduler.ts`: `notifyTaskFailure` 调用包在 try/catch，异常只 log 不抛出

## 4. Tests

- [x] 4.1 `src/task-scheduler.test.ts`: 首次失败计算正确的 backoff next_run
- [x] 4.2 `src/task-scheduler.test.ts`: backoff 被 naturalNext 上限截断
- [x] 4.3 `src/task-scheduler.test.ts`: 超限后循环任务重置计数 + 恢复自然调度
- [x] 4.4 `src/task-scheduler.test.ts`: 超限后单次任务置 paused，保留 consecutive_errors
- [x] 4.5 `src/task-scheduler.test.ts`: 成功时 consecutive_errors 重置为 0

## 5. Validation

- [x] 5.1 `npm run typecheck` 通过
- [x] 5.2 `npm test` 通过（process-runner.test.ts 的 1 个失败为预存问题，与本变更无关）
