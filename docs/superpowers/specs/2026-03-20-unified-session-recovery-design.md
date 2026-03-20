# Unified Session Recovery Design

## Context

NanoClaw persists one agent session ID per `group_folder` and reuses it on later turns. This works well for healthy sessions, but it breaks down when a stored session becomes stale or otherwise unrecoverable. We have a confirmed Claude failure mode where a resumed run fails immediately with no assistant output and the same poisoned session is retried forever until someone manually clears the database row.

The codebase already has two distinct session execution paths:

- `src/index.ts` owns persisted session state and writes replacement session IDs on successful runs.
- `container/agent-runner/src/claude-runner.ts` handles Claude SDK execution.
- `container/agent-runner/src/acp-runner.ts` handles Cursor/Codex ACP execution and already falls back to `newSession()` when `loadSession()` fails.

What is missing is a unified host-level policy for session self-healing when a backend accepts a stored session ID but then fails immediately during execution.

## Goals

- Add a single host-owned session recovery framework instead of backend-specific ad hoc retries.
- Enable automatic recovery for the confirmed Claude failure mode.
- Preserve existing ACP `loadSession() -> fallback_to_new` behavior.
- Avoid broad retries that could duplicate work or hide real backend failures.
- Make it easy to extend recovery to Cursor/Codex later if logs show a matching prompt-phase failure pattern.

## Non-Goals

- Implementing recovery for every backend failure.
- Performing repeated retries, backoff, or cross-turn recovery state machines.
- Changing database schema or adding a separate store for quarantined session IDs.
- Enabling automatic prompt-phase recovery for Cursor/Codex before we have evidence that they need it.

## Approaches Considered

### 1. Claude-only fix inside `claude-runner`

This is the fastest path to stop the known bug, but it pushes session recovery into the runner layer instead of the host layer that owns persistence. It would also force us to design a second solution later if ACP backends show a similar issue.

### 2. Host-layer recovery framework, initially enabled only for Claude

This adds a shared orchestration point in `src/index.ts` near `runAgent()`. The host decides whether a failed run qualifies for a one-time fresh-session retry. Backend-specific logic is limited to identifying whether a failure matches a recoverable session signature. This keeps ownership clean and leaves room to grow.

### 3. Host-layer framework enabled for Claude, Cursor, and Codex immediately

This gives the most uniform behavior up front, but we do not currently have enough evidence that Cursor/Codex suffer the same prompt-phase bad-session failure mode. Turning it on everywhere now increases the chance of retrying legitimate failures and duplicating execution.

## Recommended Approach

Adopt approach 2: create a host-layer recovery framework, but only enable automatic prompt-phase fallback for Claude in the first version.

This gives us a single design for “session self-healing” without pretending the failure signatures are identical across backends. Claude gets immediate value because we have already reproduced the bug. ACP backends stay on their existing, narrower protection path while we add observability.

## Design

### Host-owned recovery decision

Add a small recovery decision helper in the host execution path near `runAgent()` in `src/index.ts`. The helper evaluates:

- backend type
- whether the attempt started with a persisted `sessionId`
- whether any assistant output was streamed
- the returned error string
- whether a recovery retry has already been attempted

The helper returns one of two decisions:

- `do_not_retry`
- `retry_without_session`

### Retry semantics

If the first run started with a persisted session ID and the helper returns `retry_without_session`, the host immediately reruns the same prompt once with `sessionId` omitted. All other context remains unchanged.

If the fallback succeeds:

- the returned `newSessionId` flows through the existing successful persistence path
- future turns use the replacement session

If the fallback fails:

- the fallback error is returned
- no second recovery attempt is made
- the host does not overwrite session persistence with an error result

### Claude-specific recovery rule

In the first version, only Claude will return `retry_without_session`.

The rule is intentionally narrow:

- the attempt started with a persisted `sessionId`
- no assistant output was emitted before failure
- the error matches the reproduced immediate resume failure signature
  - `error_during_execution`
  - and/or `Claude Code process exited`

This avoids converting general Claude failures into retries.

### ACP backend treatment

Cursor and Codex continue to use ACP runner behavior as-is:

- if `loadSession()` fails, ACP already falls back to `newSession()`
- host-layer prompt-phase recovery stays disabled for ACP until we have logs showing a comparable bad-session failure after session load succeeds

To prepare for later extension, the same host helper can log when ACP failures look session-adjacent, but it should still return `do_not_retry` in the first version.

## Behavioral Boundaries

- Never retry if the original attempt had no persisted session.
- Never retry if any assistant output has already been streamed.
- Never retry more than once for a single inbound turn.
- Never clear the stored session preemptively before the fallback result is known.
- Never change ACP `loadSession()` fallback behavior as part of this design.

## Risks And Mitigations

- A narrow Claude signature could miss some recoverable cases.
  - Mitigation: keep the first version conservative and expand only with concrete evidence.
- A broad signature could duplicate work by retrying after partial execution.
  - Mitigation: require zero streamed assistant output.
- Adding orchestration in `src/index.ts` could make the flow harder to read.
  - Mitigation: isolate the recovery logic in a helper with a small typed decision surface.
- ACP may later need the same behavior in a different failure shape.
  - Mitigation: build the host framework now, but keep ACP auto-recovery behind evidence and an explicit follow-up decision.

## Testing Strategy

- Unit or integration coverage for the host recovery helper.
- Regression test for Claude: resumed attempt fails immediately, fresh-session retry succeeds, replacement session is persisted.
- Regression test for Claude: resumed attempt fails after output has begun, no retry occurs.
- Regression test for Claude: fresh-session retry also fails, only one retry occurs.
- Regression test for ACP path: existing `loadSession()` fallback behavior remains unchanged.

## Rollout Plan

1. Add the host-level recovery framework.
2. Enable recovery logic only for Claude.
3. Add structured logs for recovery decisions and non-decisions.
4. Observe Cursor/Codex failures before deciding whether prompt-phase recovery should be enabled there.

## Open Questions

- Should failed Claude recovery attempts clear the persisted session row after the fallback also fails, or should we leave that for a separate operational policy?
- Do we want a configuration flag to disable automatic session recovery per backend for emergency rollback?
