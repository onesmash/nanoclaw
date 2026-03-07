## ADDED Requirements

### Requirement: Channel Addition via Skills Engine
The customize skill SHALL guide users to add new channels using the skills engine (`scripts/apply-skill.ts`) rather than manual file creation and wiring.

#### Scenario: User wants to add a new channel
- **WHEN** a user asks to add a new messaging channel (e.g., Feishu, Telegram, Discord)
- **THEN** the skill SHALL check `.nanoclaw/state.yaml` for existing application, run `npx tsx scripts/apply-skill.ts .claude/skills/add-{channel}`, and verify with `npm test && npm run build`

#### Scenario: No skill available for requested channel
- **WHEN** no pre-built skill exists for the requested channel
- **THEN** the skill SHALL fall back to the manual pattern: create `src/channels/{name}.ts` implementing `Channel` from `src/types.ts`, using `registerChannel()` from `src/channels/registry.ts` for self-registration

### Requirement: Assistant Name Change Procedure
The customize skill SHALL provide a complete, ordered procedure for changing the assistant name that includes session clearing.

#### Scenario: User changes assistant name
- **WHEN** a user requests a name change
- **THEN** the skill SHALL execute in order:
  1. Update `ASSISTANT_NAME` in `.env`
  2. Sync to `data/env/env` (`cp .env data/env/env`)
  3. Update `trigger_pattern` in `registered_groups` DB table for all affected groups
  4. Stop the service (`launchctl unload` / `systemctl --user stop`)
  5. Delete DB session row (`DELETE FROM sessions WHERE group_folder = '...'`)
  6. Delete `.claude/` directory (`rm -rf data/sessions/{folder}/.claude`)
  7. Restart the service

#### Scenario: Name changed but session not cleared
- **WHEN** the name is updated in `.env` and CLAUDE.md but the session is not cleared
- **THEN** the agent SHALL continue responding with the old name because the Claude SDK resumes from cached session history

### Requirement: Persona Change with Session Clearing
The customize skill SHALL document both persona file locations and require session clearing after persona edits.

#### Scenario: User changes global persona
- **WHEN** a user wants to change the persona for all groups
- **THEN** the skill SHALL edit `groups/global/CLAUDE.md` (affects all groups) AND clear sessions for affected groups

#### Scenario: User changes per-group persona
- **WHEN** a user wants to change the persona for a specific group only
- **THEN** the skill SHALL edit `groups/{folder}/CLAUDE.md` (affects that group only) AND clear that group's session

#### Scenario: Persona change without session clearing
- **WHEN** `CLAUDE.md` is updated but the session is not cleared
- **THEN** the agent SHALL continue using the old persona from session history until the next new session
