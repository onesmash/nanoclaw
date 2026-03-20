## Context

NanoClaw persists session IDs at the host layer and reuses them across turns. That persistence model is owned by `src/index.ts`, while the actual execution paths are split between Claude SDK execution and ACP-backed Cursor/Codex execution. Today, recovery behavior is inconsistent: ACP already heals `loadSession()` failures by creating a new session, while Claude can get stuck retrying an unrecoverable stored session forever.

This change is cross-cutting because it introduces a single session recovery policy above the backend-specific runners. The design needs to improve resilience for the confirmed Claude failure mode without broadening retries so much that legitimate backend failures are masked or duplicated.

## Goals / Non-Goals

**Goals:**
- Introduce a host-owned session recovery decision point near `runAgent()`
- Enable one-time fresh-session fallback for the confirmed Claude immediate resume failure signature
- Preserve ACP `loadSession() -> newSession()` behavior unchanged
- Add observability for session-adjacent ACP failures so recovery can be expanded later based on evidence
- Keep session persistence semantics centralized in the host layer

**Non-Goals:**
- Automatic prompt-phase recovery for Cursor/Codex in the first version
- General retries for all backend errors
- Multi-attempt backoff or cross-turn recovery workflows
- Database schema changes or durable storage for failed session metadata

## Decisions

### Decision: Put the recovery framework in `src/index.ts`

The host layer already owns session persistence and decides when successful `newSessionId` values are written to storage. Placing recovery orchestration there keeps backend runners responsible for a single execution attempt and avoids pushing database semantics into runner implementations.

Alternative considered:
- Implement recovery independently in each runner. Rejected because it duplicates logic and would still leave session ownership split across layers.

### Decision: Use backend-specific eligibility rules behind one shared decision interface

The framework should evaluate a small shared input set: backend type, whether the run started with a persisted session, whether assistant output has already streamed, error text, and whether a recovery retry has already been attempted. The output should be a small decision surface such as `do_not_retry` or `retry_without_session`.

Alternative considered:
- Apply one universal retry rule to every backend. Rejected because backend failure modes differ and we only have strong evidence for Claude prompt-phase resume failure.

### Decision: Enable automatic prompt-phase recovery only for Claude in v1

Claude has a confirmed failure signature: the run starts with a persisted session, produces no assistant output, fails immediately, and reports `error_during_execution` / Claude process exit. That is enough evidence to enable one-time fresh-session fallback.

Cursor and Codex should not get the same prompt-phase fallback yet. ACP already heals a narrower class of failures during `loadSession()`, and we do not yet have evidence that prompt-phase failures are similarly session-corruption driven.

Alternative considered:
- Enable the same prompt-phase recovery for all backends immediately. Rejected because it increases the risk of retrying legitimate ACP failures and duplicating execution.

### Decision: Preserve existing successful session persistence flow

The fallback retry should only omit the stored `sessionId`; it should not alter prompt or other runtime context. If the fallback succeeds, the new session should flow through the current success path and replace the persisted session naturally. If the fallback fails, the fallback error should be surfaced and no additional retry should occur.

Alternative considered:
- Clear the stored session before retrying. Rejected because it mutates persistent state before the replacement session is known to be good.

## Risks / Trade-offs

- [Claude signature is too narrow] → Keep it conservative in v1 and expand only with concrete logs
- [Claude signature is too broad and duplicates work] → Require zero streamed assistant output and limit the retry to exactly one
- [Host flow becomes harder to read] → Isolate the decision logic in a helper with a small typed contract
- [ACP still has undiscovered prompt-phase session failures] → Add structured logging now and defer automatic recovery until evidence exists

## Migration Plan

1. Add the host-owned session recovery helper and retry orchestration
2. Implement Claude eligibility rules for one-time fresh-session fallback
3. Preserve ACP load-session fallback and add ACP observability for session-adjacent failures
4. Add regression tests for Claude recovery, no-retry boundaries, and ACP behavior preservation
5. Roll back by disabling the host-layer recovery branch if unexpected retries appear

## Open Questions

- Should failed Claude fallback attempts clear the stored session row after both attempts fail, or should that remain an operational/manual action?
- Do we want a backend-level feature flag for emergency disabling of automatic session recovery?
