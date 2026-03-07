## ADDED Requirements

### Requirement: Identity Creation During Setup
The setup skill SHALL include a conversational identity creation step that guides the user through choosing a name, creature, vibe, and emoji for the assistant before the service is started. This step SHALL be skipped if `IDENTITY.md` already exists with a non-empty name.

#### Scenario: First-time setup creates IDENTITY.md
- **WHEN** the setup skill runs and `IDENTITY.md` does not exist (or has no name)
- **THEN** the skill opens with "Hey. I just came online. Who am I? Who are you?" and guides the user through name, creature, vibe, and emoji fields one at a time, then writes `IDENTITY.md` to the project root

#### Scenario: Suggestions offered for stuck users
- **WHEN** the user is unsure what to enter for any identity field
- **THEN** the skill offers concrete suggestions (e.g. name suggestions like "Nova", "Pip", "Orion"; creature options like "familiar", "daemon", "oracle")

#### Scenario: Fields can be skipped
- **WHEN** the user skips a field (e.g. does not want an emoji)
- **THEN** that field is omitted from `IDENTITY.md` (no placeholder text written)

#### Scenario: Existing identity is preserved
- **WHEN** `IDENTITY.md` already exists with a name set
- **THEN** the identity setup step is skipped entirely

### Requirement: Identity Update via Customize Skill
The customize skill SHALL support updating any field in `IDENTITY.md` (name, emoji, creature, vibe, avatar). Changing the `Name` field SHALL additionally require updating the trigger pattern in the database and clearing affected sessions.

#### Scenario: User changes assistant name
- **WHEN** the user requests to change the assistant name via the customize skill
- **THEN** the skill updates the `Name` field in `IDENTITY.md`, updates the trigger pattern in the `registered_groups` database table, clears sessions for affected groups, and restarts the service

#### Scenario: User changes emoji or vibe only
- **WHEN** the user requests to change the emoji, creature, or vibe field
- **THEN** the skill updates only the relevant field in `IDENTITY.md`, clears sessions for affected groups, and restarts the service (no database trigger update required)

#### Scenario: Avatar field can be set
- **WHEN** the user provides a path or URL for the avatar field
- **THEN** the skill writes the value to the `Avatar` field in `IDENTITY.md`
