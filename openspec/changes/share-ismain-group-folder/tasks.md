## 1. Database Migration

- [x] 1.1 In `src/db.ts`, add migration to rebuild `registered_groups` without `UNIQUE` on `folder` (guard with DDL check for `UNIQUE` keyword)
- [x] 1.2 In same migration, backfill: `UPDATE registered_groups SET folder = 'main' WHERE is_main = 1`

## 2. Channel Skills

- [x] 2.1 Update `.claude/skills/add-zoom/SKILL.md` Phase 4 DM registration to use `folder: 'main'` instead of `folder: 'zoom_dm_<name>'`
- [x] 2.2 Check `.claude/skills/add-feishu/SKILL.md` for isMain registration and update to `folder: 'main'` if needed (updated `feishu_main` → `main`)

## 3. Validation

- [x] 3.1 Run `npm run typecheck` — no type errors
- [x] 3.2 Run `npm test` — 373/374 passed (1 pre-existing failure in process-runner.test.ts, unrelated to this change)
- [ ] 3.3 Manual smoke test: verify Zoom DM and existing main group both resolve to `groups/main` and share session
