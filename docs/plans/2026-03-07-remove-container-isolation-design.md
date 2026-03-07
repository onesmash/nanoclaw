# Remove Container Isolation Layer

**Date:** 2026-03-07  
**Status:** Approved  
**Risk:** MEDIUM

## Goal

Remove the Docker container dependency from NanoClaw. The agent currently runs inside a Docker container for isolation; this redesign replaces that with a direct Node.js subprocess, keeping the same stdin/stdout IPC protocol.

**Motivation:** Remove Docker as a runtime dependency. Simplify the architecture. The Claude Code SDK provides its own permission controls, making OS-level isolation unnecessary for personal use.

---

## Architecture

### Before

```
index.ts / task-scheduler.ts
  → runContainerAgent()
    → spawn(docker, [run, -i, --rm, -v ...mounts, image])
      → container/agent-runner/dist/index.js  (inside container)
        ← stdin: ContainerInput JSON
        → stdout: OUTPUT_START...OUTPUT_END markers
```

### After

```
index.ts / task-scheduler.ts
  → runProcessAgent()            ← renamed, same interface
    → spawn(node, [agent-runner/dist/index.js])
      → container/agent-runner/dist/index.js  (on host)
        ← stdin: ContainerInput JSON     (unchanged)
        → stdout: OUTPUT_START...END     (unchanged)
        ← env: NANOCLAW_* path vars      (replaces volume mounts)
```

The stdin/stdout IPC protocol, `ContainerInput`/`ContainerOutput` interfaces, streaming output, follow-up message polling, idle detection, and timeout handling are **all unchanged**.

---

## Environment Variables (replacing volume mounts)

| Variable | Value | Replaces mount |
|----------|-------|----------------|
| `NANOCLAW_GROUP_DIR` | `resolveGroupFolderPath(group.folder)` | `/workspace/group` |
| `NANOCLAW_IPC_DIR` | `resolveGroupIpcPath(group.folder)` | `/workspace/ipc` |
| `NANOCLAW_GLOBAL_DIR` | `path.join(GROUPS_DIR, 'global')` | `/workspace/global` |
| `NANOCLAW_EXTRA_DIR` | first `additionalMounts` entry (if any) | `/workspace/extra` |
| `HOME` | `path.join(DATA_DIR, 'sessions', group.folder)` | `/home/node` (for `~/.claude`) |
| `TZ` | `TIMEZONE` | `-e TZ=...` |

Secrets (`ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, etc.) continue to be passed via stdin as part of `ContainerInput.secrets`, not as environment variables.

---

## File Changes

### New file: `src/process-runner.ts`

Replaces `src/container-runner.ts`. Key changes:

- `buildVolumeMounts()` + `buildContainerArgs()` → `buildEnv()`
- `spawn(CONTAINER_RUNTIME_BIN, containerArgs)` → `spawn('node', [AGENT_RUNNER_PATH])`
- `AGENT_RUNNER_PATH = path.join(process.cwd(), 'container/agent-runner/dist/index.js')`
- All stdout/stderr handling, timeout logic, output parsing — unchanged
- Exported symbols remain: `runContainerAgent` (or rename to `runProcessAgent`), `ContainerInput`, `ContainerOutput`, `writeTasksSnapshot`, `writeGroupsSnapshot`, `AvailableGroup`

### Modified: `container/agent-runner/src/index.ts`

Replace 6 hardcoded `/workspace/` paths with env vars (fallback preserves container compatibility):

```typescript
// IPC input directory
const IPC_INPUT_DIR = path.join(process.env.NANOCLAW_IPC_DIR ?? '/workspace/ipc', 'input');

// Conversation archive directory
const conversationsDir = path.join(process.env.NANOCLAW_GROUP_DIR ?? '/workspace/group', 'conversations');

// Global CLAUDE.md
const globalClaudeMdPath = path.join(process.env.NANOCLAW_GLOBAL_DIR ?? '/workspace/global', 'CLAUDE.md');

// Extra mounted directories
const extraBase = process.env.NANOCLAW_EXTRA_DIR ?? '/workspace/extra';

// SDK working directory
cwd: process.env.NANOCLAW_GROUP_DIR ?? '/workspace/group',
```

### Modified: `container/agent-runner/src/ipc-mcp-stdio.ts`

Replace 1 hardcoded path:

```typescript
const IPC_DIR = process.env.NANOCLAW_IPC_DIR ?? '/workspace/ipc';
```

### Modified: `package.json`

Add agent-runner build step:

```json
{
  "scripts": {
    "build": "npm run build:agent-runner && tsc",
    "build:agent-runner": "cd container/agent-runner && npm install && tsc",
    "dev": "npm run build:agent-runner && tsx watch src/index.ts"
  }
}
```

### Modified: `src/index.ts`

- Change import: `./container-runner.js` → `./process-runner.js`
- Remove import: `ensureContainerRuntimeRunning`, `cleanupOrphans` from `./container-runtime.js`
- Remove function: `ensureContainerSystemRunning()`
- Remove call in `main()`: `ensureContainerSystemRunning()`

### Modified: `src/task-scheduler.ts`

- Change import: `./container-runner.js` → `./process-runner.js`

### Modified: `src/ipc.ts`

- Change import: `AvailableGroup` from `./container-runner.js` → `./process-runner.js`

### Modified: `src/group-queue.ts`

- `containerName` field semantics: now holds process identifier (group folder name) instead of Docker container name
- Rename in `shutdown()` log: `detachedContainers` → `detachedProcesses`

### Modified: `src/container-runner.test.ts`

- Update mock: `spawn(docker...)` → `spawn(node...)`
- Update spawn args assertions

### Deleted

- `src/container-runtime.ts`
- `src/container-runtime.test.ts`

---

## Per-group Agent-Runner Customization

Currently, `container-runner.ts` copies `container/agent-runner/src/` into each group's `data/sessions/{group}/agent-runner-src/` for per-group customization, recompiled at container startup. This mechanism is **removed** in this design.

All groups share the single compiled `container/agent-runner/dist/`. Per-group customization requires a manual rebuild (`npm run build:agent-runner`). This is an acceptable simplification — no existing groups use this feature.

---

## Implementation Order

Each step is independently verifiable. Complete one before starting the next.

1. **Build integration** — Add `build:agent-runner` to `package.json`, verify `npm run build` compiles both
2. **Agent-runner paths** — Replace 7 hardcoded `/workspace/` paths with env vars in `container/agent-runner/src/`
3. **`src/process-runner.ts`** — Create new file from `container-runner.ts`, replace spawn + add `buildEnv()`
4. **`src/index.ts`** — Update imports, remove `ensureContainerSystemRunning()`
5. **`src/task-scheduler.ts`** — Update import
6. **`src/ipc.ts`** — Update import
7. **`src/group-queue.ts`** — Update log field names
8. **Delete** `src/container-runtime.ts` + `src/container-runtime.test.ts`
9. **Update** `src/container-runner.test.ts`

---

## Rollback

Keep `container/Dockerfile` and `container/build.sh` in place. The agent-runner env var fallbacks (`?? '/workspace/...'`) mean the code continues to work inside a container without modification. Reverting means restoring `container-runtime.ts` and switching back to the Docker spawn in `process-runner.ts`.
