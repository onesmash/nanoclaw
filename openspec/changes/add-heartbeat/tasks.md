## 1. Data Model

- [x] 1.1 `src/types.ts`: 在 `ScheduledTask` 接口加 `task_type: 'scheduled' | 'heartbeat'` 字段
- [x] 1.2 `src/db.ts`: 在 `createSchema()` 加 ALTER TABLE 迁移（`task_type TEXT DEFAULT 'scheduled'`）
- [x] 1.3 `src/db.ts`: 更新 `createTask()` INSERT 语句包含 `task_type` 列，默认 `'scheduled'`

## 2. Scheduler Guard + Output Filtering

- [x] 2.1 `src/task-scheduler.ts`: 在 `runTask()` 执行前检查：`task_type === 'heartbeat'` 且 group 非 main → 跳过并记录 warn
- [x] 2.2 `src/task-scheduler.ts`: 提取 `stripHeartbeatOk(text: string): string` 纯函数（常量 `HEARTBEAT_ACK_MAX_CHARS = 300`）
- [x] 2.3 `src/task-scheduler.ts`: 在 heartbeat 任务的 `sendMessage` 回调中应用过滤：空结果不发送

## 3. IPC Authorization

- [x] 3.1 `src/ipc.ts`: `processTaskIpc` data 类型加 `task_type?: string` 字段
- [x] 3.2 `src/ipc.ts`: `schedule_task` 分支：`task_type === 'heartbeat'` 且 `!isMain` → reject + warn
- [x] 3.3 `src/ipc.ts`: 将校验后的 `task_type` 传给 `createTask()`（无效值回退到 `'scheduled'`）

## 4. Setup Auto-Creation

- [x] 4.1 `setup/register.ts`: 注册完成后，若 `parsed.isMain === true`，查询是否已有 id = `heartbeat-main` 的 active task
- [x] 4.2 `setup/register.ts`: 不存在时 INSERT 默认 heartbeat 任务（interval 1800000ms，`context_mode: 'group'`）
- [x] 4.3 `setup/register.ts`: 需确保 `scheduled_tasks` 表 schema 存在（加 CREATE TABLE IF NOT EXISTS）

## 5. Tests

- [x] 5.1 `src/task-scheduler.test.ts`（或新建）：`stripHeartbeatOk` 单元测试覆盖纯 OK、短尾、长尾、无 token 四种情况
- [x] 5.2 `src/ipc.test.ts`（或已有测试文件）：heartbeat IPC 授权——non-main 拒绝、main 通过
- [x] 5.3 `setup/register.test.ts`（或已有）：main group 注册后 heartbeat-main 任务存在；幂等（重复注册不重复创建）

## 6. Validation

- [x] 6.1 `npm run typecheck` 通过
- [x] 6.2 `npm test` 通过
