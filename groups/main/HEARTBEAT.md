# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.

## planning-with-files

- If a heartbeat needs planning-with-files, start from `plans/INDEX.md`.
- Only enter a task directory when the heartbeat clearly maps to a live task still listed in `plans/INDEX.md`.
- Prefer `active` tasks first. Touch `blocked` or `paused` tasks only if the heartbeat is explicitly about them.
- Do not use a root-level `task_plan.md` as the default heartbeat entrypoint.
- If there is no new work, do not revive stale task context. Only reply when the heartbeat explicitly requires one.
