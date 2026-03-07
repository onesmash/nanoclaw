## MODIFIED Requirements

### Requirement: Identity Creation During Setup
The setup skill SHALL include a conversational identity creation step that guides the user through choosing a name, creature, vibe, and emoji for the assistant before the service is started. The resulting `IDENTITY.md` SHALL be written to `groups/main/IDENTITY.md`. This step SHALL be skipped if `groups/main/IDENTITY.md` already exists with a non-empty name.

#### Scenario: First-time setup creates IDENTITY.md in groups/main
- **WHEN** the setup skill runs and `groups/main/IDENTITY.md` does not exist (or has no name)
- **THEN** the skill opens with "Hey. I just came online. Who am I? Who are you?" and guides the user through name, creature, vibe, and emoji fields one at a time, then writes `IDENTITY.md` to `groups/main/IDENTITY.md`

#### Scenario: Existing identity is preserved
- **WHEN** `groups/main/IDENTITY.md` already exists with a name set
- **THEN** the identity setup step is skipped entirely

#### Scenario: Fields can be skipped
- **WHEN** the user skips a field (e.g. does not want an emoji)
- **THEN** that field is omitted from `groups/main/IDENTITY.md` (no placeholder text written)

### Requirement: Identity Update via Customize Skill
The customize skill SHALL support updating any field in `groups/main/IDENTITY.md` (name, emoji, creature, vibe, avatar). Changing the `Name` field SHALL additionally require updating the trigger pattern in the database and clearing affected sessions.

#### Scenario: User changes assistant name
- **WHEN** the user requests to change the assistant name via the customize skill
- **THEN** the skill updates the `Name` field in `groups/main/IDENTITY.md`, updates the trigger pattern in the `registered_groups` database table, clears sessions for affected groups, and restarts the service

#### Scenario: User changes emoji or vibe only
- **WHEN** the user requests to change the emoji, creature, or vibe field
- **THEN** the skill updates only the relevant field in `groups/main/IDENTITY.md`, clears sessions for affected groups, and restarts the service (no database trigger update required)
