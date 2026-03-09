# Heartbeat Design

## Overview

Heartbeat 是一个定时触发 agent 的机制，让 agent 在没有用户消息时也能主动检查待办事项、发出提醒。

参考实现：openclaw `src/infra/heartbeat-runner.ts`

---

## 核心决策

**复用现有 scheduled task 机制**，通过新增 `task_type = 'heartbeat'` 来区分普通任务和 heartbeat 任务。

**只有 main group（`isMain === true`）可以有 heartbeat。**

---

## 实现方案

### 1. 数据模型变更

在 `ScheduledTask` 类型中新增字段：

```ts
task_type: 'scheduled' | 'heartbeat';  // 默认 'scheduled'
```

数据库迁移（`src/db.ts`）：

```sql
ALTER TABLE scheduled_tasks ADD COLUMN task_type TEXT DEFAULT 'scheduled';
```

`createTask()` INSERT 语句同步加入 `task_type` 字段。

---

### 2. HEARTBEAT_OK 过滤（`src/task-scheduler.ts`）

在 `runTask()` 的 `sendMessage` 回调中，对 `task_type === 'heartbeat'` 的任务做输出过滤：

**过滤规则（参考 openclaw）：**

- 从回复文本的开头或结尾剥离 `HEARTBEAT_OK` token
- 剥离后剩余内容 ≤ 300 字符 → **静默丢弃**，不发送给 channel
- 剥离后剩余内容 > 300 字符 → **发送剩余内容**（model 混淆了 ack 和 alert）
- 回复中**不含** `HEARTBEAT_OK` → **正常发送**（这是真正的 alert）

常量：`HEARTBEAT_ACK_MAX_CHARS = 300`

---

### 3. isMain 强制约束（`src/task-scheduler.ts`）

在 `runTask()` 执行前增加检查：

```
如果 task.task_type === 'heartbeat' 且 group.isMain !== true
  → 跳过执行，记录 warn 日志，不计入错误
```

这是运行时兜底。主要约束在 IPC 层。

---

### 4. IPC 授权（`src/ipc.ts`）

在 `processTaskIpc` 的 `schedule_task` 分支：

- 接受 `task_type` 字段（`'scheduled' | 'heartbeat'`，默认 `'scheduled'`）
- 如果 `task_type === 'heartbeat'` 且 `isMain !== true` → 拒绝，记录 warn
- 通过校验后，将 `task_type` 传入 `createTask()`

---

## 创建时机：setup 自动创建

`/setup` 流程（`scripts/apply-skill.ts` 注册 main group 后）自动为 main group 创建默认 heartbeat 任务。**不询问用户。**

### 创建逻辑

```
注册 main group 完成后：
  查询是否已存在 task_type = 'heartbeat' 且 group_folder = 'main' 的 active 任务
  → 不存在：直接创建默认 heartbeat 任务
  → 已存在：跳过（幂等）
```

### 默认任务参数

```json
{
  "id": "heartbeat-main",
  "task_type": "heartbeat",
  "prompt": "Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.",
  "schedule_type": "interval",
  "schedule_value": "1800000",
  "context_mode": "group",
  "status": "active"
}
```

- 固定 ID `heartbeat-main`，方便后续暂停/恢复/修改
- 间隔 30 分钟（1800000 ms）
- `context_mode: group`，使用 main group 的现有 session

### 用户后续操作

用户可以告诉 agent 调整 heartbeat：
- "把 heartbeat 改成每小时一次" → agent 更新 `schedule_value`
- "暂停 heartbeat" → agent pause task `heartbeat-main`
- "恢复 heartbeat" → agent resume task `heartbeat-main`

---

## HEARTBEAT.md（可选）

在 `groups/main/` 目录下放置 `HEARTBEAT.md`，agent 每次 heartbeat 时会读取：

```md
# Heartbeat checklist

- 检查是否有未回复的重要消息
- 如果是白天，偶尔主动问候一下
- 如果有待处理任务，评估是否需要提醒
```

文件不存在时：heartbeat 正常运行（prompt 里已说明 "if it exists"）。

---

## 不实现的功能

以下 openclaw 功能在 nanoclaw 中**暂不实现**（YAGNI）：

| 功能 | 原因 |
|------|------|
| Active hours（时间窗口限制） | 可通过 cron schedule 替代 |
| Transcript pruning | Claude Code CLI 自管理 session，不需要 |
| 重复 alert 去重 | 复杂度高，收益低 |
| `target: last` 路由 | nanoclaw heartbeat 固定发给自己的 group |
| per-group heartbeat（非 main） | 明确不需要 |

---

## 文件改动清单

| 文件 | 改动 |
|------|------|
| `src/types.ts` | `ScheduledTask` 加 `task_type` 字段 |
| `src/db.ts` | 迁移加列 + `createTask()` 写入 `task_type` |
| `src/task-scheduler.ts` | isMain 检查 + HEARTBEAT_OK 过滤 |
| `src/ipc.ts` | 接受 `task_type`，heartbeat 需 isMain |
| `setup/register.ts`（或 setup skill） | 注册 main group 后自动创建默认 heartbeat 任务 |

**不需要新文件。**
