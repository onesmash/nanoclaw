# System Prompt Append Order Redesign

**Date:** 2026-03-12

## Problem

Current `buildSystemPromptAppend` order is `SOUL → IDENTITY → USER → CLAUDE.md → BOOTSTRAP → TOOLS`. This puts persona files before ground rules, and omits HEARTBEAT.md and MEMORY.md.

## Desired Order

| # | File | Role | Source |
|---|------|------|--------|
| 1 | CLAUDE.md | 基础行为准则和操作指南 | `NANOCLAW_GLOBAL_DIR/CLAUDE.md` |
| 2 | TOOLS.md | 工具使用说明 | `NANOCLAW_GROUP_DIR/TOOLS.md` |
| 3 | SOUL.md | 个性特征和沟通风格 | `NANOCLAW_SOUL_PATH` |
| 4 | IDENTITY.md | 身份定义 | `NANOCLAW_IDENTITY_PATH` |
| 5 | USER.md | 用户偏好信息 | `NANOCLAW_USER_PATH` |
| 6 | HEARTBEAT.md | 定期任务清单 | `NANOCLAW_HEARTBEAT_PATH` |
| 7 | BOOTSTRAP.md | 初始化引导（仅全新工作区） | `NANOCLAW_GROUP_DIR/BOOTSTRAP.md` |
| 8 | MEMORY.md | 记忆 | `NANOCLAW_MEMORY_PATH` |

## Changes Required

### 1. `container/agent-runner/src/shared.ts`

Add two fields to `SystemContext`:

```ts
interface SystemContext {
  // existing fields ...
  heartbeatContent?: string;  // new
  memoryContent?: string;     // new
  extraDirs: string[];
}
```

In `loadSystemContext()`, add alongside SOUL/IDENTITY/USER:

```ts
const heartbeatPath = process.env.NANOCLAW_HEARTBEAT_PATH;
const memoryPath    = process.env.NANOCLAW_MEMORY_PATH;
// ...
const heartbeatContent = readIfExists(heartbeatPath);
const memoryContent    = readIfExists(memoryPath);
// include in returned object
```

Reorder `buildSystemPromptAppend()`:

```ts
export function buildSystemPromptAppend(ctx: SystemContext): string | undefined {
  const parts = [
    ctx.globalClaudeMd,    // 1. CLAUDE.md
    ctx.toolsContent,      // 2. TOOLS.md
    ctx.soulContent,       // 3. SOUL.md
    ctx.identityContent,   // 4. IDENTITY.md
    ctx.userContent,       // 5. USER.md
    ctx.heartbeatContent,  // 6. HEARTBEAT.md
    ctx.bootstrapContent,  // 7. BOOTSTRAP.md
    ctx.memoryContent,     // 8. MEMORY.md
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
```

Note: `globalClaudeMd` is only injected for non-main groups (`!containerInput.isMain`) — this logic is unchanged.

### 2. `src/process-runner.ts`

Add two new env vars after `NANOCLAW_USER_PATH`:

```ts
NANOCLAW_HEARTBEAT_PATH: path.join(GROUPS_DIR, 'main', 'HEARTBEAT.md'),
NANOCLAW_MEMORY_PATH:    path.join(GROUPS_DIR, 'main', 'MEMORY.md'),
```

Both files are optional — `readIfExists` silently skips missing files.

## No Other Files Changed

`claude-runner.ts` and `cursor-runner.ts` call `buildSystemPromptAppend(ctx)` unchanged — they pick up the new order automatically.
