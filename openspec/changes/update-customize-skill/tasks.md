## 1. Update `.claude/skills/customize/SKILL.md`

- [x] 1.1 Update Key Files table — remove `src/channels/whatsapp.ts`, add `src/channels/registry.ts`; note `ASSISTANT_NAME` is in `.env`
- [x] 1.2 Rewrite "Adding a New Input Channel" section — use skills-engine workflow instead of manual coding
- [x] 1.3 Rewrite "Changing Assistant Name" sub-section — add full procedure: `.env`, `data/env/env`, DB trigger_pattern, session clearing
- [x] 1.4 Rewrite "Persona Changes" sub-section — document global vs per-group files, add session clearing note
- [x] 1.5 Fix example interaction — replace hardcoded "Andy" with `{ASSISTANT_NAME}` placeholder
