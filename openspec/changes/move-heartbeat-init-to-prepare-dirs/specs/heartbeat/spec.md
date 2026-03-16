## MODIFIED Requirements

### Requirement: HEARTBEAT.md Auto-initialized in prepareGroupDirs
The system SHALL create `HEARTBEAT.md` from an embedded template in `prepareGroupDirs()` when the main group's agent is first launched, if the file does not already exist. The file SHALL NOT be created during `setup/register.ts`.

#### Scenario: HEARTBEAT.md created on first agent launch when absent
- **GIVEN** `groups/{folder}/HEARTBEAT.md` does not exist
- **WHEN** the main group agent is launched and `prepareGroupDirs()` runs
- **THEN** `HEARTBEAT.md` is created with the standard template content

#### Scenario: Existing HEARTBEAT.md is not overwritten
- **GIVEN** `groups/{folder}/HEARTBEAT.md` already exists with custom content
- **WHEN** the main group agent is launched
- **THEN** `HEARTBEAT.md` is unchanged (idempotent, no overwrite)

#### Scenario: HEARTBEAT.md is recreated after manual deletion
- **GIVEN** `groups/{folder}/HEARTBEAT.md` was deleted after initial setup
- **WHEN** the main group agent is next launched
- **THEN** `HEARTBEAT.md` is recreated with the standard template content

#### Scenario: register.ts does not create HEARTBEAT.md
- **GIVEN** a main group is registered via `setup/register.ts`
- **WHEN** registration completes
- **THEN** no `HEARTBEAT.md` file is created by the registration step

#### Scenario: Non-main group does not get HEARTBEAT.md
- **GIVEN** a non-main group agent is launched
- **WHEN** `prepareGroupDirs()` runs
- **THEN** no `HEARTBEAT.md` file is created for that group
