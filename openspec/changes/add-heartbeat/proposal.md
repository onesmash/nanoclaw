# Change: Add Heartbeat for Main Group

## Why

Main group agent 目前只有被动响应（用户发消息才运行）。没有主动检查机制，agent 无法在没有用户消息的情况下发出提醒、跟踪待办事项或执行背景任务。

## What Changes

- 在 `ScheduledTask` 类型和 `scheduled_tasks` 表中新增 `task_type` 字段（`'scheduled' | 'heartbeat'`，默认 `'scheduled'`）
- `task-scheduler.ts`：heartbeat 任务在运行前检查 `isMain`；输出做 HEARTBEAT_OK 过滤（静默 ack，传递 alert）
- `ipc.ts`：`schedule_task` IPC 接受 `task_type` 字段；`task_type: 'heartbeat'` 只允许 main group 创建
- `setup/register.ts`：注册 main group（`--is-main`）后自动创建固定 ID `heartbeat-main` 的 heartbeat 任务（幂等）

## Impact

- Affected specs: `heartbeat`（新建）
- Affected code:
  - `src/types.ts` — `ScheduledTask` 加 `task_type` 字段
  - `src/db.ts` — schema 迁移 + `createTask()` 写入 `task_type`
  - `src/task-scheduler.ts` — isMain 运行时守卫 + HEARTBEAT_OK 过滤
  - `src/ipc.ts` — `schedule_task` 接受并校验 `task_type`
  - `setup/register.ts` — main group 注册完成后自动创建 heartbeat 任务
