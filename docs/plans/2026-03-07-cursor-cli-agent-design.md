# Design: Cursor CLI Agent Integration

## Context

NanoClaw 当前通过 `src/process-runner.ts` 直接 spawn `node container/agent-runner/dist/index.js` 来运行 Claude agent。本设计新增 `container/cursor-agent-runner/` 作为平行的 agent 后端包，与 `container/agent-runner/` 遵循完全相同的 IPC 协议，通过环境变量切换，不影响任何现有路径。

## Goals / Non-Goals

- Goals:
  - 新建 `container/cursor-agent-runner/`：封装 Cursor CLI headless 调用，对外提供与 `container/agent-runner` 完全相同的 stdin/stdout IPC 协议
  - 通过 `AGENT_BACKEND=cursor` 环境变量切换 agent 后端
  - `src/index.ts` 和 `src/task-scheduler.ts` 零改动
  - 复用现有 SQLite `sessions` 表管理 Cursor session_id
- Non-Goals:
  - 群组级别的 agent 类型配置
  - 修改现有 Claude agent-runner 行为
  - 新增 IPC 协议或数据库 schema

## Decisions

### Decision: 新 runner 包而非 src/cursor-runner.ts

将 Cursor CLI 适配逻辑封装在 `container/cursor-agent-runner/` 独立包中（与 `container/agent-runner/` 平级），而非在 `src/` 层新增 runner 函数。

优势：
- `src/index.ts`、`src/task-scheduler.ts` 完全不动
- `process-runner.ts` 只改 `AGENT_RUNNER_PATH` 的赋值（~5 行），不改调用逻辑
- 新 runner 与旧 runner 结构对称，模式一致

### Decision: 全局环境变量切换

`AGENT_BACKEND=cursor|claude`（默认 `claude`）。与现有 `TIMEZONE`、`ASSISTANT_NAME` 等配置风格一致，`.env` 中一行切换。

### Decision: 复用现有 sessions 表存储 Cursor session_id

Cursor 的 `session_id` 是 UUID，与 Claude 的 sessionId 格式相同。`ContainerOutput.newSessionId` 回传 Cursor session_id，现有的 sessions 存取逻辑完全不变。

## Architecture

```
消息到达（WhatsApp/Slack 等）
    ↓
src/index.ts（不变）
    ↓
src/process-runner.ts
    ├─ AGENT_BACKEND=cursor  → spawn container/cursor-agent-runner/dist/index.js
    └─ 默认                  → spawn container/agent-runner/dist/index.js
```

## cursor-agent-runner IPC 实现

**stdin 读取：** `ContainerInput` JSON（`prompt`、`sessionId`、`groupFolder` 字段）

**spawn 命令：**

```bash
agent -p "<prompt>" \
  --output-format stream-json \
  --stream-partial-output \
  --force --trust --approve-mcps \
  --workspace <groupDir> \
  [--resume <sessionId>]
```

Auth 由 `agent login` 本地管理，不传 API key。

**NDJSON → IPC 转译：**

| 事件类型 | 输出到 stdout |
|---------|-------------|
| `system` (init) | 取 `session_id`，暂存 |
| `assistant` | `OUTPUT_START\n{"status":"success","result":"<text>",...}\nOUTPUT_END`（流式） |
| `result` success | `OUTPUT_START\n{"status":"success","result":"...","newSessionId":"..."}\nOUTPUT_END` |
| `result` error | `OUTPUT_START\n{"status":"error","error":"..."}\nOUTPUT_END` |
| `thinking`、`tool_call` | 忽略 |

## Files Changed

| 文件 | 改动 |
|------|------|
| `container/cursor-agent-runner/` | **新建** 包（package.json + tsconfig.json + src/index.ts，~100 行） |
| `src/config.ts` | +1 行：`export const AGENT_BACKEND` |
| `src/process-runner.ts` | ~5 行：`AGENT_RUNNER_PATH` 条件化 |
| `package.json` | 新增 `build:cursor-agent-runner`，接入 `build`/`dev` 脚本 |

## Risks / Trade-offs

- **Cursor CLI 版本依赖**：需提前 `agent login` 认证；凭证本地持久化，服务重启后无需重登录。
- **stream-json 格式变更**：`result` 事件结构稳定，风险低；`assistant` 事件格式若变更需同步更新转译逻辑。
- **workspace 权限**：`--workspace` 设为 groupDir，agent 有完整群组文件读写权限，与原 Claude agent 权限相当。
