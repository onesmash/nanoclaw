# Change: Update customize skill to reflect current architecture and patterns

## Why

The `/customize` skill documentation was written for an older architecture (manual channel wiring, WhatsApp-centric). After migrating to a skills-engine and process-based runner, several patterns changed. The skill now gives incorrect guidance—especially for name/persona changes, which require session clearing and were not documented.

## What Changes

- **Key Files section**: Remove stale `src/channels/whatsapp.ts` reference; add `src/channels/registry.ts` (self-registration); reflect that `ASSISTANT_NAME` lives in `.env`, not `src/config.ts`
- **Adding a new channel**: Replace "create `.ts` file + wire in `main()`" with skills-engine workflow (`scripts/apply-skill.ts`)
- **Changing assistant name**: Add full procedure — update `.env`, sync `data/env/env`, update DB trigger_pattern, clear session (stop service → delete DB row + `.claude/` → restart)
- **Persona changes**: Clarify that there are TWO persona files (`groups/global/CLAUDE.md` for all groups, `groups/{folder}/CLAUDE.md` for per-group), and that session clearing is required after changes
- **Example interaction**: Remove hardcoded "Andy" reference; use `{ASSISTANT_NAME}` placeholder

## Impact

- Affected specs: customize-skill (new capability spec)
- Affected code: `.claude/skills/customize/SKILL.md`
