## 1. Move File and Update Host-Side Reader

- [x] 1.1 Move `IDENTITY.md` from project root to `groups/main/IDENTITY.md`
- [x] 1.2 Update `src/identity.ts` `loadAgentIdentity()` — change path from `{projectRoot}/IDENTITY.md` to `{projectRoot}/groups/main/IDENTITY.md`

## 2. Process Runner

- [x] 2.1 Update `src/process-runner.ts` `buildEnv()` — change `NANOCLAW_IDENTITY_PATH` to `path.join(GROUPS_DIR, 'main', 'IDENTITY.md')`

## 3. Skill Updates

- [x] 3.1 Update `.claude/skills/setup/SKILL.md` — identity step writes to `groups/main/IDENTITY.md`
- [x] 3.2 Update `.claude/skills/customize/SKILL.md` — all references to `IDENTITY.md` updated to `groups/main/IDENTITY.md`

## 4. Validation

- [x] 4.1 Run `npm run build` — confirm TypeScript compiles without errors
- [x] 4.2 Run `npm test` — confirm existing tests pass
