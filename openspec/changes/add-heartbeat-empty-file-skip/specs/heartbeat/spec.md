## ADDED Requirements

### Requirement: Heartbeat Preflight Skip for Empty HEARTBEAT.md
The system SHALL skip heartbeat task execution — without spawning a container or invoking the LLM — when HEARTBEAT.md exists and contains no actionable content (only whitespace, ATX comment headers, or empty list items). The task's `next_run` SHALL still be advanced as normal.

#### Scenario: Template-only file causes skip
- **WHEN** a heartbeat task is due
- **AND** HEARTBEAT.md exists and contains only comment lines (e.g. `# Keep this file empty...`)
- **THEN** the task is skipped with a debug log, `next_run` is advanced, and no container is spawned

#### Scenario: File with actionable content runs normally
- **WHEN** a heartbeat task is due
- **AND** HEARTBEAT.md contains at least one non-comment, non-empty line (e.g. `- check email`)
- **THEN** the task runs normally

#### Scenario: Missing file does not trigger skip
- **WHEN** a heartbeat task is due
- **AND** HEARTBEAT.md does not exist
- **THEN** the task runs normally (the LLM decides what to do)

#### Scenario: Read error does not trigger skip
- **WHEN** HEARTBEAT.md cannot be read due to a non-ENOENT error
- **THEN** the task runs normally (fail-open)

#### Scenario: Hash-tag without space is treated as content
- **WHEN** HEARTBEAT.md contains a line like `#TODO` or `#tag` (no space after `#`)
- **THEN** the line is treated as actionable content and the task runs normally

#### Scenario: Empty list items are not treated as content
- **WHEN** HEARTBEAT.md contains only lines like `- [ ]`, `* `, or `- `
- **THEN** the file is treated as effectively empty and the task is skipped

#### Scenario: Skip does not write a run log entry
- **WHEN** a heartbeat task is skipped due to an empty HEARTBEAT.md
- **THEN** no entry is written to the task run log (`logTaskRun` is not called)
