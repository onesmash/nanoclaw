---
name: add-planning-with-files
description: Add Manus-style file-based planning to NanoClaw container agents. Teaches agents to use task_plan.md, notes.md, and deliverable files for persistent working memory across complex multi-step tasks. Use when you want agents to handle long research tasks, multi-phase projects, or any work requiring structured progress tracking without losing context.
---

# Add Planning with Files

Installs the Manus-style file-based planning methodology into all container agents. After applying, agents will automatically create `task_plan.md` for complex tasks, store findings in `notes.md`, and track phase progress with checkboxes — surviving context resets and session restarts.

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `add-planning-with-files` is in `applied_skills`, skip to Phase 3 (Verify).

## Phase 2: Apply

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist:

```bash
npx tsx scripts/apply-skill.ts --init
```

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-planning-with-files
```

This adds to `container/skills/planning-with-files/`:
- `SKILL.md` — core methodology (3-file pattern, workflow loop, critical rules)
- `examples.md` — worked examples for research, build, and debug tasks
- `reference.md` — Manus context engineering principles
- `scripts/` — session init, catchup, and completion check scripts
- `templates/` — starter templates for `task_plan.md`, `progress.md`, `findings.md`

No source code changes, no npm dependencies, no environment variables needed.

### Update HEARTBEAT.md

Append the planning check task to `groups/main/HEARTBEAT.md` (skip if the line already exists):

```
# Planning — check unfinished tasks (runs with heartbeat, ~every 30 min)
- If task_plan.md or progress.md exists in the current directory or groups/main: read it, check for unchecked/incomplete phases; if found, advance one or two steps or report progress; otherwise reply HEARTBEAT_OK.
```

### Update MEMORY.md

Append the following entry to `groups/main/MEMORY.md` (skip if already present):

```
## Planning with Files

The planning-with-files skill is installed. For any complex or multi-step task:
- Create task_plan.md first with phases and checkboxes
- Store research findings in notes.md or findings.md
- Update plan checkboxes after each phase
- Read task_plan.md before each major decision to keep goals in focus
- Use templates in container/skills/planning-with-files/templates/ as starting points
```

### Restart service

```bash
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# Linux: systemctl --user restart nanoclaw
```

## Phase 3: Verify

### Test with a complex task

Send a multi-step request to any registered group, for example:

> "Research the top 3 open-source vector databases, compare their performance, and write a recommendation."

The agent should:
1. Create `task_plan.md` before starting
2. Store research findings in `notes.md`
3. Update plan checkboxes after each phase
4. Deliver the final output

Check the group's workspace directory to confirm the files were created:

```bash
ls groups/<folder>/
# Should show: task_plan.md, notes.md, recommendation.md (or similar)
```

## Notes

- No runtime code or dependencies — documentation and scripts only
- Planning files (`task_plan.md`, `notes.md`) are created in the agent's working directory (`groups/<folder>/`) and persist across sessions
- To remove: delete `container/skills/planning-with-files/`, revert the HEARTBEAT.md and MEMORY.md additions, then restart the service
