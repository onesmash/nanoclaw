# Multi-Task Planning

Use this layout when one project needs to track multiple long-running tasks at the same time.

## Layout

```text
plans/
  INDEX.md
  _template/
    task_plan.md
    findings.md
    progress.md
  <task-slug>/
    task_plan.md
    findings.md
    progress.md
```

## Workflow

1. Review `INDEX.md`
2. Choose one task directory
3. `cd` into that task directory
4. Use planning-with-files normally from there
5. Update `INDEX.md` when task state changes
6. When a task is complete, mark it `done`, remove it from `INDEX.md`, and archive it by default

## Rules

- One long-running task per directory
- Keep only 1-3 tasks marked `active`
- Use `paused`, `blocked`, or `dormant` instead of leaving stale tasks as `active`
- Never combine multiple task histories in one `task_plan.md`

## Status Meanings

- `active`: should be worked on again soon
- `paused`: intentionally parked
- `blocked`: waiting on something external
- `dormant`: kept for later, not expected soon
- `done`: finished

## Completing a Task

When a task is done:

1. Set `status: done` in `task_plan.md`
2. Update `last_touched`
3. Record the completion result in `progress.md`
4. Remove the task from `INDEX.md`
5. Move the task directory to `plans/archive/<task-slug>/` unless there is a reason to keep it nearby

You can archive with:

```bash
sh ${CLAUDE_PLUGIN_ROOT}/scripts/archive-task.sh <task-slug>
```

Archived tasks do not need to stay in `INDEX.md`. Search `plans/archive/` directly when you need old context.

## Heartbeat Tasks

For heartbeat or scheduled maintenance runs:

1. Read the heartbeat prompt
2. Read `INDEX.md`
3. Only enter a task directory if the heartbeat matches a live task still listed in `INDEX.md`
4. If there is no new work, do not revive stale task state; only reply if the heartbeat explicitly requires one

Do not start from a root-level `task_plan.md`. In multi-task mode, `INDEX.md` is the heartbeat entrypoint.
