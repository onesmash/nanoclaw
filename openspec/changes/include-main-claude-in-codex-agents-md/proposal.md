## Why

Codex runner currently syncs `AGENTS.md` from shared system-context fragments, but it does not include the main group's own `CLAUDE.md`. That leaves Codex sessions in `groups/main` without the channel-specific instructions and long-term context that already exist for the main group.

## What Changes

- Define the expected AGENTS.md composition for Codex-backed main-group sessions.
- Require Codex runner to include `groups/main/CLAUDE.md` content when generating `AGENTS.md` for the main group.
- Preserve current behavior for non-main groups and for groups that do not have a local `CLAUDE.md`.

## Capabilities

### New Capabilities
- `codex-agent-context`: Defines how Codex runner prepares AGENTS.md so main-group sessions receive their group-specific CLAUDE.md instructions in addition to shared system context.

### Modified Capabilities

## Impact

- Affected code:
  - `container/agent-runner/src/codex-runner.ts`
  - `container/agent-runner/src/shared.ts`
- Affected system behavior:
  - Generated `AGENTS.md` content for Codex runner sessions in `groups/main`
- No external API or dependency changes
