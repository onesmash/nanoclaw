## ADDED Requirements

### Requirement: Main-group CLAUDE.md is included in Codex AGENTS.md
Codex runner SHALL include the current group's `CLAUDE.md` content at the beginning of `{groupDir}/AGENTS.md` when the session is running for the main group and the file exists. The remaining shared system context SHALL appear after the local `CLAUDE.md` content.

#### Scenario: Main group with local CLAUDE.md
- **WHEN** `codex-runner` prepares a session for a main group and `{groupDir}/CLAUDE.md` exists with content
- **THEN** `{groupDir}/AGENTS.md` starts with the contents of `{groupDir}/CLAUDE.md`
- **AND** the shared system-context content is appended after it

### Requirement: Non-main groups keep current AGENTS.md behavior
Codex runner SHALL preserve the existing AGENTS.md generation behavior for non-main groups and SHALL NOT prepend a group-local `CLAUDE.md` for those sessions as part of this change.

#### Scenario: Non-main group
- **WHEN** `codex-runner` prepares a session for a non-main group
- **THEN** `{groupDir}/AGENTS.md` contains only the shared system-context composition defined for Codex runner
- **AND** no additional prepend step is applied for a group-local `CLAUDE.md`

### Requirement: Missing local CLAUDE.md does not block session startup
Codex runner SHALL continue generating `{groupDir}/AGENTS.md` and starting the session when the main group's local `CLAUDE.md` file is absent, unreadable, or empty, using only the shared system-context content that is otherwise available.

#### Scenario: Main group without usable CLAUDE.md
- **WHEN** `codex-runner` prepares a session for a main group and `{groupDir}/CLAUDE.md` is missing, empty, or cannot be used
- **THEN** `{groupDir}/AGENTS.md` is generated from the shared system-context content only
- **AND** session startup continues without failing because of the local `CLAUDE.md`
