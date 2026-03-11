# Change: Share main folder across all isMain groups

## Why

Multiple channels (Zoom DM, Feishu DM, WhatsApp self-chat) can each be registered as `isMain: true`. Currently each gets its own `folder` in the DB, resulting in separate agent workspaces — the same assistant has separate memory, identity, and session per channel (split personality). The correct behavior is for all isMain groups to share one identity and context regardless of which channel the message arrives from.

## What Changes

- Remove the `UNIQUE` constraint on `registered_groups.folder` to allow multiple isMain groups to share `folder = 'main'`
- Add a DB migration that rebuilds the table without UNIQUE and backfills existing isMain groups to `folder = 'main'`
- Update channel skill registration docs to use `folder: 'main'` for isMain groups

## Impact

- Affected specs: `group-folder-sharing` (new)
- Affected code: `src/db.ts` (migration), `.claude/skills/add-zoom/SKILL.md`, `.claude/skills/add-feishu/SKILL.md` (if applicable)
