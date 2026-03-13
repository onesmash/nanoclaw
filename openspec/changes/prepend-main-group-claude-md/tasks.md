# Tasks: prepend-main-group-claude-md

- [x] `cursor-runner.ts`: Add `isMain: boolean` parameter to `syncAgentsMd`; when `true`, read `{groupDir}/CLAUDE.md` (skip silently if absent) and prepend it before `buildSystemPromptAppend(ctx)` output
- [x] `cursor-runner.ts`: Update `syncAgentsMd` call in `main()` to pass `containerInput.isMain`
- [x] Rebuild agent-runner: `cd container/agent-runner && npm run build`
- [ ] Manual validation: confirm `{groupDir}/AGENTS.md` starts with `CLAUDE.md` content when main group agent runs
