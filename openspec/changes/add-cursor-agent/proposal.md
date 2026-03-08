# Change: Add Cursor CLI Agent Backend

## Why

NanoClaw 目前只支持 Claude Agent SDK（通过 `container/agent-runner`）作为唯一 agent 后端。Cursor CLI（`agent` 命令）提供 headless 模式（`--output-format stream-json`），支持流式 NDJSON 输出、session 续接（`--resume <session_id>`）、多模型切换，可作为独立的 agent 后端，通过环境变量全局切换。

## What Changes

- `container/agent-runner/src/index.ts` 重构为薄分发器：读取 `AGENT_BACKEND` 环境变量，路由到 `claude-runner.ts` 或 `cursor-runner.ts`
- 新建 `container/agent-runner/src/shared.ts`：提取公共接口和工具函数（`ContainerInput`、`ContainerOutput`、`readStdin`、`writeOutput`、markers）
- 新建 `container/agent-runner/src/claude-runner.ts`：承接现有 `index.ts` 的全部 Claude agent 逻辑（零行为变更）
- 新建 `container/agent-runner/src/cursor-runner.ts`：spawn `agent -p` headless，解析 NDJSON，转译为 `OUTPUT_START...OUTPUT_END` markers；复用 `dist/ipc-mcp-stdio.js` 作为 MCP server（写入 workspace `.cursor/mcp.json`）
- `src/config.ts` 新增 `AGENT_BACKEND` 配置项（`claude` | `cursor`，默认 `claude`）
- `src/process-runner.ts` 向子进程传入 `AGENT_BACKEND` 环境变量（约 2 行）
- `src/index.ts` 和 `src/task-scheduler.ts` **完全不需要改动**

## Impact

- Affected specs: `agent-execution`（ADDED: Cursor CLI Backend）
- Affected code:
  - `container/agent-runner/src/shared.ts` — 新建（提取公共类型和工具）
  - `container/agent-runner/src/claude-runner.ts` — 新建（承接 index.ts 逻辑）
  - `container/agent-runner/src/cursor-runner.ts` — 新建（Cursor CLI 实现）
  - `container/agent-runner/src/index.ts` — 精简为分发器（~10 行）
  - `src/config.ts` — +1 行
  - `src/process-runner.ts` — +2 行（传入 AGENT_BACKEND env var）
