# Change: Move IDENTITY.md to groups/main/

## Why

`IDENTITY.md` currently lives at the project root, separate from the other agent personality files (`CLAUDE.md`, `SOUL.md`) which live in `groups/main/`. Moving it to `groups/main/` co-locates all identity and persona files in one place — the agent's "home directory" — making it easier to find, edit, and understand the relationship between files.

## What Changes

- `IDENTITY.md` moves from project root → `groups/main/IDENTITY.md`
- `src/identity.ts`: `loadAgentIdentity()` reads from `groups/main/IDENTITY.md`
- `src/process-runner.ts`: `NANOCLAW_IDENTITY_PATH` updated to `{GROUPS_DIR}/main/IDENTITY.md`
- `.claude/skills/setup/SKILL.md`: identity step writes to `groups/main/IDENTITY.md`
- `.claude/skills/customize/SKILL.md`: references updated to `groups/main/IDENTITY.md`

## Impact

- Affected specs: `agent-identity` (MODIFIED), `identity-lifecycle` (MODIFIED)
- Affected code: `src/identity.ts`, `src/process-runner.ts`
- Affected skills: `.claude/skills/setup/SKILL.md`, `.claude/skills/customize/SKILL.md`
- **Migration**: existing `IDENTITY.md` at project root must be moved to `groups/main/IDENTITY.md`
