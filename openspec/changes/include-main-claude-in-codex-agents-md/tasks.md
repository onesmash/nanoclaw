## 1. Shared AGENTS.md composition

- [x] 1.1 Update `container/agent-runner/src/shared.ts` so `syncAgentsMd` can determine whether the current session is for the main group and prepend `{groupDir}/CLAUDE.md` only for that case
- [x] 1.2 Preserve the existing fallback behavior in `syncAgentsMd` so missing or unusable local `CLAUDE.md` content does not prevent AGENTS.md generation

## 2. Codex runner wiring

- [x] 2.1 Update `container/agent-runner/src/codex-runner.ts` to pass the main-group signal required by the revised `syncAgentsMd` interface
- [x] 2.2 Confirm Codex runner still writes AGENTS.md before ACP session startup and does not change non-main group behavior

## 3. Validation

- [x] 3.1 Rebuild the agent runner package from `container/agent-runner`
- [x] 3.2 Manually validate that a main-group Codex session generates `{groupDir}/AGENTS.md` starting with `groups/main/CLAUDE.md` content
- [x] 3.3 Manually validate that a non-main Codex session still generates `{groupDir}/AGENTS.md` without prepending a group-local `CLAUDE.md`
