## ADDED Requirements

### Requirement: Style and Personality Changes Route to IDENTITY.md

The customize skill SHALL route style, personality, vibe, and character change requests to `groups/main/IDENTITY.md` (specifically the `Vibe`, `Creature`, `Emoji`, and `Avatar` fields), clearly distinguishing this from behavioral rule changes which belong in `CLAUDE.md`.

#### Scenario: User requests a style or vibe change

- **WHEN** a user asks to change how the assistant sounds, its personality, vibe, tone, or character
- **THEN** the skill SHALL edit the `Vibe` field (and optionally `Creature`, `Emoji`) in `groups/main/IDENTITY.md`, then stop the service, clear sessions for affected groups, and restart the service

#### Scenario: User requests a behavioral rule change

- **WHEN** a user asks to change what the assistant does, add a capability, modify response format rules, or update instructions
- **THEN** the skill SHALL edit `groups/global/CLAUDE.md` (for all groups) or `groups/{folder}/CLAUDE.md` (for a specific group), then clear the affected group's session

#### Scenario: Skill documentation distinguishes the two file roles

- **WHEN** a user reads the customize skill guidance on changing assistant behavior
- **THEN** the skill SHALL clearly present:
  - `groups/main/IDENTITY.md` → who the assistant IS (name, vibe, creature, emoji, avatar)
  - `groups/global/CLAUDE.md` / `groups/{folder}/CLAUDE.md` → what the assistant DOES (behavioral rules, tool instructions, formatting guidelines)
