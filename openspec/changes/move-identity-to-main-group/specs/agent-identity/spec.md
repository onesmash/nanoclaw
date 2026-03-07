## MODIFIED Requirements

### Requirement: Identity File Format
The project SHALL support an `IDENTITY.md` file at `groups/main/IDENTITY.md` defining the assistant's identity with the following optional fields: `Name`, `Emoji`, `Creature`, `Vibe`, `Avatar`. The file uses Markdown list format (`- **Field:** Value`). Placeholder values from the template (e.g. "pick something you like") SHALL be treated as absent. This location co-locates identity with the other agent personality files (`CLAUDE.md`, `SOUL.md`).

#### Scenario: Valid identity file is parsed
- **WHEN** `groups/main/IDENTITY.md` exists with `- **Name:** Looong` and `- **Emoji:** 🐉`
- **THEN** the parser returns `{ name: "Looong", emoji: "🐉" }`

#### Scenario: Placeholder values are ignored
- **WHEN** `groups/main/IDENTITY.md` contains `- **Name:** _(pick something you like)_`
- **THEN** the parser returns `{}` (name treated as absent)

#### Scenario: File is missing
- **WHEN** `groups/main/IDENTITY.md` does not exist
- **THEN** `loadAgentIdentity()` returns `null` and `getAssistantName()` returns `'Andy'`

### Requirement: Identity Propagation to Agent Runner
The system SHALL pass the absolute path of `groups/main/IDENTITY.md` to the agent subprocess via the `NANOCLAW_IDENTITY_PATH` environment variable for all groups.

#### Scenario: Process runner sets identity path
- **WHEN** the process runner spawns an agent subprocess for any group
- **THEN** the subprocess environment includes `NANOCLAW_IDENTITY_PATH` pointing to `{GROUPS_DIR}/main/IDENTITY.md`
