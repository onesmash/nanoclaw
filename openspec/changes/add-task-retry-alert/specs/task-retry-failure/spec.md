# task-retry-failure Specification

## Purpose

任务调度器在任务失败后自动重试（指数退避），并在每次失败时通知用户；超过重试上限后根据任务类型决定后续行为。

## ADDED Requirements

### Requirement: Consecutive Error Tracking

`scheduled_tasks` 表 SHALL 有 `consecutive_errors INTEGER DEFAULT 0` 字段，用于跟踪连续失败次数。任务成功时重置为 0，失败时递增。

#### Scenario: Reset on success
- **GIVEN** a task with `consecutive_errors = 2`
- **WHEN** the task run completes without error
- **THEN** `consecutive_errors` is updated to `0`
- **AND** `next_run` is set to `computeNextRun(task)`

#### Scenario: Increment on failure
- **GIVEN** a task with `consecutive_errors = 1`
- **WHEN** the task run fails with an error
- **THEN** `consecutive_errors` is updated to `2`

### Requirement: Exponential Backoff Retry

任务失败且 `attempt`（= `consecutive_errors + 1`）未超过 `MAX_RETRIES`（= 3）时，调度器 SHALL 使用 `min(naturalNext, backoffNext)` 计算下次运行时间。退避间隔 `RETRY_BACKOFF_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000]`，索引为 `attempt - 1`。

#### Scenario: First failure schedules fast retry
- **GIVEN** a recurring task fails for the first time (`attempt = 1`)
- **AND** `backoffNext = Date.now() + 30_000`
- **AND** `naturalNext` is further in the future than `backoffNext`
- **THEN** `next_run` is set to `new Date(backoffNext).toISOString()`
- **AND** `consecutive_errors` is set to `1`

#### Scenario: Backoff capped by natural schedule
- **GIVEN** a task with a very short interval fails (`attempt = 1`)
- **AND** `naturalNext` is sooner than `backoffNext`
- **THEN** `next_run` is set to `new Date(naturalNext).toISOString()`

#### Scenario: Once task has no natural next
- **GIVEN** a `schedule_type: 'once'` task fails with `attempt < MAX_RETRIES`
- **AND** `computeNextRun(task)` returns `null`
- **THEN** `next_run` is set to `new Date(backoffNext).toISOString()`

### Requirement: Max Retry Limit — Recurring Task

连续失败次数达到 `MAX_RETRIES` 时，循环任务（`schedule_type !== 'once'`）SHALL 恢复自然调度并重置 `consecutive_errors = 0`。

#### Scenario: Recurring task recovers natural schedule after max retries
- **GIVEN** a cron/interval task where `attempt = MAX_RETRIES` (= 3)
- **WHEN** the task fails
- **THEN** `consecutive_errors` is reset to `0`
- **AND** `next_run` is set to `computeNextRun(task)`
- **AND** task `status` remains `'active'`

### Requirement: Max Retry Limit — Once Task

连续失败次数达到 `MAX_RETRIES` 时，单次任务（`schedule_type === 'once'`）SHALL 置 `status: 'paused'`，不再自动重试。

#### Scenario: Once task paused after max retries
- **GIVEN** a `schedule_type: 'once'` task where `attempt = MAX_RETRIES` (= 3)
- **WHEN** the task fails
- **THEN** `status` is updated to `'paused'`
- **AND** `consecutive_errors` is preserved for diagnostics

### Requirement: Failure Notification

每次任务失败（无论是否超限）SHALL 向 `task.chat_jid` 发送通知，通知内容根据状态分三种场景。

#### Scenario: Retry in progress notification
- **GIVEN** a task fails with `attempt < MAX_RETRIES`
- **WHEN** `notifyTaskFailure` is called
- **THEN** a message is sent to `task.chat_jid` containing the task name, attempt count, truncated error, and next retry delay in seconds

#### Scenario: Max retries reached — recurring task notification
- **GIVEN** a recurring task reaches `attempt = MAX_RETRIES`
- **WHEN** `notifyTaskFailure` is called
- **THEN** a message is sent to `task.chat_jid` indicating retries are exhausted, the natural next run time, and a suggestion to ask for immediate retry

#### Scenario: Max retries reached — once task notification
- **GIVEN** a `schedule_type: 'once'` task reaches `attempt = MAX_RETRIES`
- **WHEN** `notifyTaskFailure` is called
- **THEN** a message is sent to `task.chat_jid` indicating the task is paused and suggesting the user ask for re-execution

#### Scenario: Notification failure does not break scheduler
- **GIVEN** `notifyTaskFailure` throws an error
- **THEN** the error is caught and logged
- **AND** the scheduler loop continues normally
