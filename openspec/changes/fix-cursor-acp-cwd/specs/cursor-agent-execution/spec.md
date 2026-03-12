## ADDED Requirements

### Requirement: Spawn Working Directory
`cursor-runner` SHALL spawn `agent acp` with `cwd` set to `groupDir`, so that the Cursor agent's workspace is the group directory rather than the nanoclaw project root.

#### Scenario: Correct workspace
- **WHEN** `agent acp` is spawned for a group
- **THEN** the agent process working directory equals `NANOCLAW_GROUP_DIR` (e.g., `groups/main`)

#### Scenario: Project root not used as workspace
- **WHEN** `agent acp` is spawned
- **THEN** the agent process working directory is NOT the nanoclaw project root
