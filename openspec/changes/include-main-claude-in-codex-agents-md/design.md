## Context

Codex-backed sessions currently call `syncAgentsMd(groupDir, ctx, log)` from `container/agent-runner/src/codex-runner.ts` before starting ACP. The shared helper writes `buildSystemPromptAppend(ctx)` to `{groupDir}/AGENTS.md`, which captures shared system-context fragments but not the main group's own `CLAUDE.md`.

The repository already uses `groups/main/CLAUDE.md` as the main channel's durable instruction and memory file. As a result, Codex runner misses instructions that are available elsewhere in the system unless AGENTS.md generation explicitly includes that file for main-group sessions.

## Goals / Non-Goals

**Goals:**
- Ensure Codex runner includes `groups/main/CLAUDE.md` when generating `AGENTS.md` for main-group sessions.
- Keep AGENTS.md generation centralized in shared context helpers instead of duplicating composition logic inside `codex-runner.ts`.
- Preserve existing behavior for non-main groups and for missing local `CLAUDE.md` files.

**Non-Goals:**
- Changing how Claude runner builds its prompt or AGENTS.md behavior for other backends.
- Refactoring all agent-context assembly into a new abstraction beyond the small change needed here.
- Changing the contents or semantics of `groups/main/CLAUDE.md` itself.

## Decisions

### Decision: Extend shared AGENTS.md composition instead of patching Codex prompt assembly

Codex runner already delegates AGENTS.md writing to `syncAgentsMd`, so the least risky design is to extend that shared path to support main-group `CLAUDE.md` inclusion. This keeps file generation behavior in one place and avoids creating a Codex-only fork of system-context assembly.

Alternative considered:
- Add a Codex-specific prepend step in `codex-runner.ts` before or after `syncAgentsMd`.
  Rejected because it would split responsibility between runner code and shared helpers, making future prompt-context changes easier to miss.

### Decision: Gate local CLAUDE.md inclusion on main-group execution

Only main-group sessions should receive `groups/main/CLAUDE.md` through this path. Non-main groups already rely on their existing shared/global context rules, and broadening local-file inclusion would risk unintentionally changing other group contexts.

Alternative considered:
- Always read `{groupDir}/CLAUDE.md` for any group if the file exists.
  Rejected because the requested change is specifically about main-group context parity, and widening scope would create behavior changes not requested by the user.

### Decision: Silently skip absent local CLAUDE.md files

If `{groupDir}/CLAUDE.md` is missing or empty, AGENTS.md generation should fall back to the current shared system-context content. This matches the repository's existing pattern of optional context files not failing agent startup.

Alternative considered:
- Warn or fail when main-group `CLAUDE.md` is missing.
  Rejected because missing optional context files are already tolerated, and a hard failure would reduce runner resilience.

## Risks / Trade-offs

- [Behavior divergence between Codex and older changes] -> Keep the requirement scoped to Codex AGENTS.md generation and validate with a main-group run.
- [Duplicated instruction content if future shared context also starts loading main `CLAUDE.md`] -> Keep composition logic centralized so any future consolidation happens in one helper.
- [Silent skip may hide configuration mistakes] -> Preserve existing resilience, but include manual validation to confirm the generated file starts with the expected content.

## Migration Plan

1. Update shared AGENTS.md generation to accept enough context to know whether the current session is for the main group.
2. For main-group Codex sessions, prepend `{groupDir}/CLAUDE.md` before the shared system-context append content.
3. Rebuild the agent-runner package and manually validate generated `AGENTS.md` content for both main and non-main flows.
4. Roll back by restoring the previous AGENTS.md composition logic if prompt-context regression is observed.

## Open Questions

- Whether the same main-group `CLAUDE.md` behavior should later be standardized across all ACP backends, not just Codex, can be handled in a separate change if desired.
