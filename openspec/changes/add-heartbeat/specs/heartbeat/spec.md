## ADDED Requirements

### Requirement: Heartbeat Task Type
The system SHALL support a `task_type` field on scheduled tasks with values `'scheduled'` (default) or `'heartbeat'`, persisted in the `scheduled_tasks` SQLite table.

#### Scenario: Default task type is scheduled
- **WHEN** a task is created without specifying `task_type`
- **THEN** `task_type` defaults to `'scheduled'`

#### Scenario: Heartbeat task type persisted
- **WHEN** a task is created with `task_type: 'heartbeat'`
- **THEN** the value is stored in the database and returned by all task queries

---

### Requirement: Heartbeat Restricted to Main Group
The system SHALL only allow `task_type: 'heartbeat'` tasks to be created for and executed by the main group (`isMain === true`).

#### Scenario: IPC rejects heartbeat from non-main group
- **WHEN** a non-main group submits a `schedule_task` IPC command with `task_type: 'heartbeat'`
- **THEN** the task is rejected with a warning log and no task is created

#### Scenario: Scheduler skips heartbeat for non-main group
- **WHEN** a heartbeat task is due but its group is not the main group
- **THEN** the task is skipped with a warning log and not counted as an error

#### Scenario: Main group can create heartbeat tasks via IPC
- **WHEN** the main group submits a `schedule_task` IPC command with `task_type: 'heartbeat'`
- **THEN** the task is created successfully

---

### Requirement: HEARTBEAT_OK Output Filtering
The system SHALL filter the output of heartbeat tasks before delivering to the channel, treating `HEARTBEAT_OK` as a silent acknowledgement.

#### Scenario: Pure HEARTBEAT_OK reply is silently dropped
- **WHEN** a heartbeat task output is exactly `HEARTBEAT_OK`
- **THEN** no message is sent to the channel

#### Scenario: HEARTBEAT_OK with short trailing content is dropped
- **WHEN** a heartbeat output starts or ends with `HEARTBEAT_OK` and the remaining content is ≤ 300 characters
- **THEN** no message is sent to the channel

#### Scenario: HEARTBEAT_OK with long content delivers the remainder
- **WHEN** a heartbeat output starts with `HEARTBEAT_OK` and the remaining content is > 300 characters
- **THEN** the `HEARTBEAT_OK` token is stripped and the remaining content is sent to the channel

#### Scenario: Alert without HEARTBEAT_OK is delivered normally
- **WHEN** a heartbeat output does not contain `HEARTBEAT_OK`
- **THEN** the full output is delivered to the channel unchanged

#### Scenario: Regular scheduled tasks are unaffected
- **WHEN** a `task_type: 'scheduled'` task output contains any text
- **THEN** no HEARTBEAT_OK filtering is applied

---

### Requirement: Auto-Create Heartbeat on Main Group Registration
The system SHALL automatically create a default heartbeat task when a main group is registered during setup.

#### Scenario: Heartbeat task created on first main group registration
- **WHEN** `setup/register.ts` is run with `--is-main`
- **AND** no active heartbeat task with id `heartbeat-main` exists
- **THEN** a heartbeat task with id `heartbeat-main`, interval 30 minutes, `context_mode: 'group'` is created

#### Scenario: Idempotent on re-registration
- **WHEN** `setup/register.ts` is run with `--is-main` again
- **AND** `heartbeat-main` task already exists
- **THEN** no duplicate task is created

#### Scenario: Default heartbeat prompt
- **WHEN** the default heartbeat task is created
- **THEN** its prompt is: `Read HEARTBEAT.md if it exists. Follow it strictly. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply HEARTBEAT_OK.`
