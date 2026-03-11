## ADDED Requirements

### Requirement: isMain Groups Share Main Folder
All groups with `isMain: true` SHALL use `folder = 'main'`, sharing a single agent workspace (filesystem, session, IPC directory) regardless of which channel the message arrives from.

#### Scenario: Multiple isMain groups resolve to same directory
- **WHEN** two groups are registered with `isMain: true` (e.g. WhatsApp self-chat and Zoom DM)
- **THEN** both resolve `NANOCLAW_GROUP_DIR` to `groups/main`

#### Scenario: Multiple isMain groups share the same session
- **WHEN** a message arrives on any isMain group
- **THEN** the session is looked up and stored under key `'main'`, not the group's JID-derived folder

#### Scenario: Migration backfills existing isMain groups
- **WHEN** the database contains isMain groups with non-`'main'` folders (e.g. `zoom_dm_hui`)
- **THEN** on next startup those rows are updated to `folder = 'main'` automatically

### Requirement: Non-isMain Groups Retain Isolated Folders
Groups with `isMain: false` (or `isMain` unset) SHALL continue to use their own dedicated folder, independent of the main workspace.

#### Scenario: Non-isMain group is unaffected by migration
- **WHEN** a non-isMain group is registered with `folder = 'zoom_channel_foo'`
- **THEN** its folder is unchanged by the migration and it retains its own workspace
