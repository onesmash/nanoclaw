# Change: Fix Cursor MCP Workspace Root Detection

## Why

After deploying `fix-cursor-mcp-proxy-delivery` and `pre-approve-mcps-before-acp`, the
nanoclaw MCP tools were still not available to the agent in production. End-to-end testing
revealed two additional bugs not caught by the debug script (which uses fresh tmpdirs):

### 1. Agent CLI uses the git root as workspace, not `groupDir`

`cursor-runner` was writing `.cursor/mcp.json` to `{groupDir}/.cursor/mcp.json` and calling
`preApproveMcps(groupDir)`. However, the `agent` CLI walks up the directory tree from `cwd`
to the nearest git/Cursor project root and uses that as its workspace.

Since `groups/main` lives inside the `nanoclaw-zoom` git repo, the agent detects
`nanoclaw-zoom/` as the workspace. Writing to `groups/main/.cursor/mcp.json` is silently
ignored — the agent never reads it.

**Verified behaviour:**
- `agent mcp list` run from `groups/main` shows only user-level MCPs (`gitnexus`, `DevHelper`);
  the `mcp-proxy` entry from `groups/main/.cursor/mcp.json` is invisible.
- `agent mcp enable` run from `groups/main` stores approvals in the `nanoclaw-zoom` project
  slug, not the `groups/main` slug.
- `--workspace groups/main` does **not** override this behaviour — MCP config is still read
  from the git root workspace.
- The debug script (`debug-mcp-proxy.js`) worked because it uses fresh `mkdtemp` directories
  outside any git repo, so the agent uses the tmpdir itself as the workspace.

**Fix:** Write `.cursor/mcp.json` to `projectRoot` (the nanoclaw-zoom git root, available as
`$NANOCLAW_PROJECT_ROOT` in the runner env). Pass `projectRoot` as `cwd` to `preApproveMcps`.
Keep `--workspace groupDir` on the `agent acp` spawn — this controls where the agent
reads/writes files, which should remain `groupDir`.

### 2. `waitForProxy` was called after spawning the agent

The original sequence called `waitForProxy` inside the `try` block — after `agentProc` was
already spawned. The agent reads `.cursor/mcp.json` at startup and immediately attempts to
connect to the proxy. If the proxy was not yet listening when the agent started, the MCP
connection failed silently and tools were unavailable for the entire session.

**Fix:** Call `waitForProxy(port)` synchronously before writing `mcp.json` and before
spawning `agent acp`.

### 3. `preApproveMcps` was called before writing `mcp.json`

In an earlier iteration `preApproveMcps` was placed before writing `.cursor/mcp.json`. The
approval hash is derived from the URL including the port; approving before writing means the
stored hash won't match the file written immediately after.

**Fix:** Write `mcp.json` first, then call `preApproveMcps`.

## What Changes

- **`cursor-runner.ts`**:
  - Read `projectRoot` from `process.env.NANOCLAW_PROJECT_ROOT ?? process.cwd()`
  - Write `.cursor/mcp.json` to `path.join(projectRoot, '.cursor', 'mcp.json')`
  - Call `preApproveMcps(projectRoot)` (was `preApproveMcps(groupDir)`)
  - Call `waitForProxy(port)` before writing `mcp.json` (was inside try block after spawning agent)
  - Keep `--workspace groupDir` on the `agent acp` spawn

## Impact

- Affected specs: `cursor-agent-execution`
  - MODIFIED: MCP Proxy Lifecycle (steps 6-7 now reference `projectRoot`, not `groupDir`)
  - MODIFIED: Multiple concurrent sessions scenario
- Supersedes: the `{groupDir}/.cursor/mcp.json` path in `fix-cursor-mcp-proxy-delivery`
- Supersedes: the `cwd: groupDir` in `preApproveMcps` from `pre-approve-mcps-before-acp`
- Affected code: `container/agent-runner/src/cursor-runner.ts`
- Validation: end-to-end test via live nanoclaw session confirmed nanoclaw MCP tools available
