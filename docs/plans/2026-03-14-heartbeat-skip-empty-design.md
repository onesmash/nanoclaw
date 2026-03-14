# Heartbeat Skip When HEARTBEAT.md Is Empty

## Overview

When HEARTBEAT.md exists but contains only template/comment content, skip the heartbeat execution entirely — no container spawn, no LLM API call, no token burn. The scheduled task still advances its `next_run` as normal.

Reference implementation: openclaw `src/auto-reply/heartbeat.ts` + `src/infra/heartbeat-runner.ts`.

---

## Behavior

| HEARTBEAT.md state | Behavior |
|---|---|
| Does not exist (ENOENT) | Run normally — LLM decides what to do |
| Exists, only comments/empty lines | **Skip**, advance `next_run` |
| Exists, has actionable content | Run normally |
| Read error (non-ENOENT) | Run normally — fail-open |

---

## Implementation

Two changes to `src/task-scheduler.ts`.

### 1. Add `isHeartbeatContentEffectivelyEmpty()`

Port directly from openclaw `src/auto-reply/heartbeat.ts`:

```ts
export function isHeartbeatContentEffectivelyEmpty(content: string | null | undefined): boolean {
  if (content == null || typeof content !== 'string') return false;
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#+(\s|$)/.test(trimmed)) continue;           // ATX header (# space required)
    if (/^[-*+]\s*(\[[\sXx]?\]\s*)?$/.test(trimmed)) continue; // empty list item
    return false; // actionable content found
  }
  return true;
}
```

**Line classification:**

| Line | Treated as |
|---|---|
| `# Header` | Comment (skipped) |
| `## Section` | Comment (skipped) |
| `#TODO`, `#tag` | Content (not skipped — no space after `#`) |
| `- [ ]`, `- `, `* ` | Empty list item (skipped) |
| `- check email` | Content (not skipped) |
| blank line | Skipped |

### 2. Skip gate in `runTask()`

Insert after the `isMain` check, before `runContainerAgent`:

```ts
if (task.task_type === 'heartbeat') {
  const heartbeatPath = path.join(groupDir, 'HEARTBEAT.md');
  try {
    const content = fs.readFileSync(heartbeatPath, 'utf8');
    if (isHeartbeatContentEffectivelyEmpty(content)) {
      logger.debug({ taskId: task.id }, 'Heartbeat skipped: HEARTBEAT.md is empty or template');
      const nextRun = computeNextRun(task);
      updateTaskAfterRun(task.id, nextRun, 'Skipped: empty HEARTBEAT.md');
      return;
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Non-ENOENT read error: proceed normally (fail-open)
    }
    // ENOENT: file absent — proceed normally (same as openclaw)
  }
}
```

**No `logTaskRun` on skip** — a skip is not a run. It consumes no resources and does not belong in run history.

---

## Files Changed

| File | Change |
|---|---|
| `src/task-scheduler.ts` | Add `isHeartbeatContentEffectivelyEmpty()` + skip gate in `runTask()` |

No other files need changing.
