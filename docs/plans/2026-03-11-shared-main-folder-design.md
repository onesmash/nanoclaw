# isMain Groups Share Main Folder

## Problem

Currently each registered group has a unique `folder` in the DB. When multiple channels (Zoom DM, Feishu DM, WhatsApp self-chat) are registered as `isMain: true`, they each get separate folders (e.g. `zoom_dm_hui`, `feishu_dm_hui`, `main`). This means the same assistant has separate memory, identity, and session per channel — split personality.

The correct behavior: all `isMain` groups represent the same "owner DM" and should share one identity, memory, and session regardless of which channel the message arrives from.

## Design

### Core Change

Remove the `UNIQUE` constraint on `registered_groups.folder`. This allows multiple isMain groups to share `folder = 'main'`, which naturally gives them:

- **Shared filesystem** — `NANOCLAW_GROUP_DIR` resolves to `groups/main` for all of them
- **Shared session** — `sessions['main']` is the same session ID
- **Shared IPC** — `data/ipc/main/` is the same directory
- **Shared permissions** — `folderIsMain.get('main') = true` for all

No other code changes are needed.

### Migration

Two steps in `src/db.ts`:

**Step 1: Rebuild table without UNIQUE**

SQLite does not support `ALTER TABLE DROP CONSTRAINT`. Must recreate:

```sql
CREATE TABLE registered_groups_new (
  jid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  folder TEXT NOT NULL,
  trigger_pattern TEXT NOT NULL,
  added_at TEXT NOT NULL,
  container_config TEXT,
  requires_trigger INTEGER DEFAULT 1,
  is_main INTEGER DEFAULT 0
);
INSERT INTO registered_groups_new SELECT * FROM registered_groups;
DROP TABLE registered_groups;
ALTER TABLE registered_groups_new RENAME TO registered_groups;
```

**Step 2: Migrate existing isMain groups to folder = 'main'**

```sql
UPDATE registered_groups SET folder = 'main' WHERE is_main = 1;
```

Run once at startup, guarded by detecting `UNIQUE` in the existing table's DDL.

### Channel Skills

All channel skills (`add-zoom`, `add-feishu`, etc.) should register isMain groups with `folder: 'main'`:

```typescript
// DM / owner channel — always use folder: 'main'
registerGroup("zoom:dm:<userId>", {
  name: "<person-name>",
  folder: "main",
  requiresTrigger: false,
  isMain: true,
});

// Non-main group channel — use its own folder
registerGroup("zoom:<channel_id>", {
  name: "<channel-name>",
  folder: "zoom_<channel-name>",
  requiresTrigger: true,
});
```

## Impact Analysis

| Code path | Effect | Safe? |
|-----------|--------|-------|
| `sessions[group.folder]` | Same folder → same session | ✓ |
| `resolveGroupFolderPath(group.folder)` | Same folder → same directory | ✓ |
| `resolveGroupIpcPath(group.folder)` | Same IPC dir, snapshot overwrites | ✓ |
| `folderIsMain.get(group.folder)` | All isMain groups get main privileges | ✓ |
| `task-scheduler find(g.folder === task.group_folder)` | Returns first match — all share same dir/session anyway | ✓ |

Risk: **LOW**

## Files to Change

- `src/db.ts` — add migration (rebuild table + update folders)
- `.claude/skills/add-zoom/SKILL.md` — update Phase 4 to use `folder: 'main'`
- `.claude/skills/add-feishu/SKILL.md` — same (if applicable)
