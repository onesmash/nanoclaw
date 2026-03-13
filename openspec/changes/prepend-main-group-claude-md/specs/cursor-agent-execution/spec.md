## MODIFIED Requirements

### Requirement: System Context Delivery via AGENTS.md

`cursor-runner` SHALL deliver system context to Cursor by writing `{groupDir}/AGENTS.md` before spawning `agent acp`. For main groups (`isMain = true`), the group-level `CLAUDE.md` SHALL be prepended before the system context.

#### Scenario: Non-main group — system context only

- **WHEN** `isMain` is `false` and SOUL.md, IDENTITY.md, USER.md, etc. are present and non-empty
- **THEN** their concatenated content is written to `{groupDir}/AGENTS.md`
- **AND** the prompt sent to Cursor contains only the user message

#### Scenario: Main group — CLAUDE.md present

- **WHEN** `isMain` is `true` and `{groupDir}/CLAUDE.md` exists and is non-empty
- **THEN** `{groupDir}/AGENTS.md` is written with `CLAUDE.md` content first, followed by the system context from `buildSystemPromptAppend`
- **AND** the prompt sent to Cursor contains only the user message

#### Scenario: Main group — CLAUDE.md absent

- **WHEN** `isMain` is `true` and `{groupDir}/CLAUDE.md` does not exist
- **THEN** `{groupDir}/AGENTS.md` is written with only the system context from `buildSystemPromptAppend`
- **AND** the prompt sent to Cursor contains only the user message

#### Scenario: No system context files exist

- **WHEN** none of the system context files exist
- **THEN** `{groupDir}/AGENTS.md` is written with empty content (clearing any previous content)
- **AND** the prompt sent to Cursor contains only the user message

#### Scenario: Write failure

- **WHEN** writing `AGENTS.md` fails (e.g., permissions error)
- **THEN** the error is logged and `cursor-runner` continues without aborting the agent session
