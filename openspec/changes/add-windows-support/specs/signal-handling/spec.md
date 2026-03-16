## ADDED Requirements

### Requirement: Windows SIGBREAK Graceful Shutdown
The main process (`src/index.ts`) SHALL register a `SIGBREAK` handler on Windows that calls the same `shutdown()` function used for `SIGTERM` and `SIGINT`. The handler SHALL only be registered when `process.platform === 'win32'`.

#### Scenario: SIGBREAK triggers graceful shutdown on Windows
- **WHEN** the process receives `SIGBREAK` on a Windows host
- **THEN** `shutdown('SIGBREAK')` is called, the group queue is drained, all channels are disconnected, and the process exits cleanly

#### Scenario: SIGBREAK handler not registered on Unix
- **WHEN** the process starts on macOS or Linux
- **THEN** no `SIGBREAK` listener is registered, leaving signal behavior unchanged on those platforms
