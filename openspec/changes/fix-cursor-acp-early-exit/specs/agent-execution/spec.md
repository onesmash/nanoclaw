## MODIFIED Requirements

### Requirement: Cursor ACP Runner Error Handling
`container/agent-runner/src/cursor-runner.ts` SHALL handle premature `agent acp` process exit cleanly, ensuring the error is captured and reported via the standard `ContainerOutput` protocol.

#### Scenario: ACP process exits before initialize completes
- **WHEN** `agentProc` (the `agent acp` process) exits with a non-zero code before `connection.initialize()` resolves (e.g., due to network error `ENOTFOUND api2.cursor.sh`)
- **THEN** the early exit is detected via a `close`-event Promise that races against the main execution flow
- **AND** the `try-catch` block catches the resulting rejection
- **AND** `writeOutput({ status: 'error', error: <message>, newSessionId: sessionId })` is called
- **AND** the process exits with code 1
- **AND** Node.js does NOT emit `Warning: Detected unsettled top-level await`

#### Scenario: ACP process exits mid-conversation
- **WHEN** `agentProc` exits unexpectedly during `connection.prompt()` or between IPC poll iterations
- **THEN** the same race mechanism detects the exit
- **AND** `writeOutput({ status: 'error', ... })` is called with the exit code in the error message
- **AND** the process exits with code 1
