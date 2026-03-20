## Why

NanoClaw currently has inconsistent session self-healing behavior across backends. Claude can enter a persistent crash loop when a stored session becomes unrecoverable, while ACP backends only recover the narrower `loadSession()` failure case and do not yet share a host-owned recovery policy.

## What Changes

- Add a host-layer session recovery framework owned by the main execution path in `src/index.ts`
- Enable one-time fresh-session fallback for the confirmed Claude immediate resume failure signature
- Preserve the existing ACP `loadSession() -> newSession()` behavior without enabling new prompt-phase retries for Cursor/Codex yet
- Add structured logging so ACP backends can be observed for future prompt-phase session recovery support
- Add regression coverage for host-owned recovery decisions and Claude fallback behavior

## Capabilities

### New Capabilities
- `unified-session-recovery`: Define and orchestrate a single host-owned session recovery policy with backend-specific eligibility rules

### Modified Capabilities

## Impact

- Affected code:
  - `src/index.ts` for host-owned retry orchestration and recovery decisions
  - `container/agent-runner/src/claude-runner.ts` only as needed to preserve signal fidelity for host decisions
  - ACP execution path logging in `container/agent-runner/src/acp-runner.ts`
  - related tests covering retry eligibility, replacement session persistence, and ACP behavior preservation
- Affected systems:
  - persisted session state in `store/messages.db`
  - Claude backend execution
  - Cursor/Codex observability for session-adjacent failures
