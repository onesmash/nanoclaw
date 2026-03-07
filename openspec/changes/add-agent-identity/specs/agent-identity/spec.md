## ADDED Requirements

### Requirement: Identity File Format
The project SHALL support an `IDENTITY.md` file at the project root defining the assistant's identity with the following optional fields: `Name`, `Emoji`, `Creature`, `Vibe`, `Avatar`. The file uses Markdown list format (`- **Field:** Value`). Placeholder values from the template (e.g. "pick something you like") SHALL be treated as absent.

#### Scenario: Valid identity file is parsed
- **WHEN** `IDENTITY.md` exists at the project root with `- **Name:** Looong` and `- **Emoji:** 🐉`
- **THEN** the parser returns `{ name: "Looong", emoji: "🐉" }`

#### Scenario: Placeholder values are ignored
- **WHEN** `IDENTITY.md` contains `- **Name:** _(pick something you like)_`
- **THEN** the parser returns `{}` (name treated as absent)

#### Scenario: File is missing
- **WHEN** `IDENTITY.md` does not exist at the project root
- **THEN** `loadAgentIdentity()` returns `null` and `getAssistantName()` returns `'Andy'`

### Requirement: Assistant Name Derivation
The system SHALL derive `ASSISTANT_NAME` from `IDENTITY.md` at startup. `ASSISTANT_NAME` SHALL be the value of the `Name` field if present and non-placeholder, otherwise `'Andy'`. The `ASSISTANT_NAME` env var in `.env` SHALL be ignored.

#### Scenario: Name present in IDENTITY.md
- **WHEN** `IDENTITY.md` has `- **Name:** Nova`
- **THEN** `ASSISTANT_NAME` is `"Nova"` and `TRIGGER_PATTERN` matches `@Nova`

#### Scenario: IDENTITY.md absent, no env var
- **WHEN** `IDENTITY.md` does not exist
- **THEN** `ASSISTANT_NAME` defaults to `'Andy'`

### Requirement: Trigger Pattern Driven by Identity Name
The system SHALL construct the trigger pattern `TRIGGER_PATTERN` as `/^@{ASSISTANT_NAME}\b/i` where `ASSISTANT_NAME` is sourced from `IDENTITY.md`. This pattern is used to detect messages directed at the assistant.

#### Scenario: Custom name sets trigger
- **WHEN** `IDENTITY.md` sets `Name: Pip`
- **THEN** messages starting with `@Pip` are processed and messages starting with `@Andy` are not

### Requirement: Identity Propagation to Agent Runner
The system SHALL pass the absolute path of `IDENTITY.md` to the agent subprocess via the `NANOCLAW_IDENTITY_PATH` environment variable, consistent with other `NANOCLAW_*` path variables.

#### Scenario: Process runner sets identity path
- **WHEN** the process runner spawns an agent subprocess for any group
- **THEN** the subprocess environment includes `NANOCLAW_IDENTITY_PATH` pointing to `{projectRoot}/IDENTITY.md`

### Requirement: Identity Injected into Agent System Prompt
The agent runner SHALL read `IDENTITY.md` from `NANOCLAW_IDENTITY_PATH` (falling back to `/workspace/identity.md`) and inject its contents into the agent's system prompt when the file exists.

#### Scenario: Identity file present at runtime
- **WHEN** `NANOCLAW_IDENTITY_PATH` points to a readable `IDENTITY.md`
- **THEN** the agent system prompt includes the identity content, giving the agent awareness of its name, creature, vibe, and emoji

#### Scenario: Identity file absent at runtime
- **WHEN** `NANOCLAW_IDENTITY_PATH` points to a non-existent file
- **THEN** the agent launches normally without an identity section in the system prompt
