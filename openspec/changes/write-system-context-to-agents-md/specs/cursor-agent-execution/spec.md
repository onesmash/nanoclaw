## MODIFIED Requirements

### Requirement: System Context Delivery
`cursor-runner` SHALL deliver system context (SOUL/IDENTITY/USER/globalClaudeMd/BOOTSTRAP/TOOLS) by writing it to `{groupDir}/AGENTS.md` before spawning `agent acp`, rather than prepending it to the user prompt.

The write MUST:
- Always overwrite `{groupDir}/AGENTS.md`, even when system context is empty (write empty string to clear stale content)
- Use `buildSystemPromptAppend(ctx)` from `shared.ts` to produce the file content
- Occur before `spawn('agent', ['acp'])` so Cursor reads the updated file at session start

The user prompt sent via `connection.prompt()` MUST contain only the user message text (with scheduled task prefix if applicable), with no system context prepended.

#### Scenario: System context files exist
- **WHEN** SOUL.md, IDENTITY.md, USER.md, etc. are present and non-empty
- **THEN** their concatenated content is written to `{groupDir}/AGENTS.md`
- **AND** the prompt sent to Cursor contains only the user message

#### Scenario: No system context files exist
- **WHEN** none of the system context files exist
- **THEN** `{groupDir}/AGENTS.md` is written with empty content (clearing any previous content)
- **AND** the prompt sent to Cursor contains only the user message

#### Scenario: Write failure
- **WHEN** writing `AGENTS.md` fails (e.g., permissions error)
- **THEN** the error is logged and `cursor-runner` continues without aborting the agent session
