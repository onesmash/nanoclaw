## MODIFIED Requirements

### Requirement: HEARTBEAT.md Is Not Git-Tracked
`groups/main/HEARTBEAT.md` SHALL be excluded from git tracking so that user-specific runtime configuration does not appear in version control.

#### Scenario: File is ignored by git after change
- **GIVEN** `.gitignore` no longer contains `!groups/main/HEARTBEAT.md`
- **WHEN** `git check-ignore -v groups/main/HEARTBEAT.md` is run
- **THEN** the output shows a matching ignore rule (e.g., `groups/main/*`)

#### Scenario: Modified HEARTBEAT.md does not appear in git status
- **GIVEN** the user edits `groups/main/HEARTBEAT.md`
- **WHEN** `git status` is run
- **THEN** the file does not appear in modified or untracked files

---

### Requirement: HEARTBEAT.md Auto-initialized on Main Group Registration
The system SHALL create `HEARTBEAT.md` from an embedded template when registering a main group, if the file does not already exist.

#### Scenario: HEARTBEAT.md created when absent
- **GIVEN** `groups/{folder}/HEARTBEAT.md` does not exist
- **WHEN** a main group (`--is-main`) is registered via `setup/register.ts`
- **THEN** `HEARTBEAT.md` is created with the standard template content

#### Scenario: Existing HEARTBEAT.md is not overwritten
- **GIVEN** `groups/{folder}/HEARTBEAT.md` already exists with custom content
- **WHEN** the same main group is registered again
- **THEN** `HEARTBEAT.md` is unchanged (idempotent, no overwrite)

#### Scenario: Non-main group registration does not create HEARTBEAT.md
- **GIVEN** a group is registered without `--is-main`
- **WHEN** `setup/register.ts` runs
- **THEN** no `HEARTBEAT.md` file is created for that group
