## ADDED Requirements

### Requirement: Host execution SHALL own session recovery decisions
NanoClaw SHALL evaluate session recovery eligibility in the host execution layer using a shared decision interface instead of distributing prompt-phase recovery logic independently across backend runners.

#### Scenario: Host decides whether to retry without session
- **WHEN** a backend execution attempt finishes with an error
- **THEN** the host evaluates backend type, stored-session presence, output progress, and error shape before deciding whether to retry without a session

### Requirement: Claude execution SHALL recover once from immediate resume failure
When a Claude-backed turn starts with a persisted session ID and fails immediately with the confirmed resume-failure signature before any assistant output is emitted, NanoClaw SHALL retry the same turn exactly once without the persisted session ID.

#### Scenario: Claude immediate resume failure triggers fresh-session retry
- **WHEN** a Claude-backed turn starts with a persisted session ID
- **AND** the first attempt emits no assistant output
- **AND** the error matches the immediate Claude resume-failure signature
- **THEN** NanoClaw retries the same prompt once without a session ID

#### Scenario: Successful Claude fallback replaces the persisted session
- **WHEN** the Claude fresh-session retry succeeds and returns a new session ID
- **THEN** NanoClaw persists the replacement session ID for that group

#### Scenario: Failed Claude fallback does not retry again
- **WHEN** the Claude fresh-session retry fails
- **THEN** NanoClaw returns the fallback failure
- **AND** NanoClaw does not perform any additional retries for that turn

### Requirement: ACP execution SHALL preserve existing load-session recovery semantics
Cursor and Codex ACP execution MUST preserve the existing behavior that falls back to `newSession()` when `loadSession()` fails, and MUST NOT automatically add prompt-phase fresh-session fallback in the first version of this change.

#### Scenario: ACP load-session failure still falls back to new session
- **WHEN** an ACP-backed turn attempts to load a persisted session
- **AND** `loadSession()` fails
- **THEN** ACP creates a new session using the existing fallback path

#### Scenario: ACP prompt-phase failures are observed but not auto-retried
- **WHEN** an ACP-backed turn fails after session loading has already succeeded
- **THEN** NanoClaw records structured recovery observability for that failure
- **AND** NanoClaw does not perform prompt-phase fresh-session retry in the first version

### Requirement: Session recovery SHALL remain narrowly bounded
NanoClaw MUST avoid broad session recovery that could duplicate work or hide legitimate backend failures.

#### Scenario: No retry without a persisted session
- **WHEN** an execution attempt starts without a persisted session ID
- **THEN** NanoClaw does not perform fresh-session recovery retry

#### Scenario: No retry after output has begun
- **WHEN** an execution attempt has already emitted assistant output before it fails
- **THEN** NanoClaw does not perform fresh-session recovery retry
