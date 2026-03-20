## 1. Host Recovery Framework

- [x] 1.1 Add a host-layer session recovery decision helper near `runAgent()` that evaluates backend, stored-session presence, output progress, and error shape
- [x] 1.2 Add one-time retry orchestration that reruns an eligible turn without `sessionId`

## 2. Backend Behavior

- [x] 2.1 Implement Claude-specific eligibility rules for immediate resume failure recovery
- [x] 2.2 Preserve ACP `loadSession()` fallback behavior and add structured observability for ACP prompt-phase session-adjacent failures without enabling auto-retry

## 3. Persistence And Verification

- [x] 3.1 Ensure successful fallback runs persist replacement session IDs through the existing success path
- [x] 3.2 Add regression tests for Claude recovery, no-retry boundaries, and ACP behavior preservation
