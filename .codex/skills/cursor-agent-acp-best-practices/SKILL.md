---
name: cursor-agent-acp-best-practices
description: >
  Reference guide for integrating MCP servers with Cursor's `agent acp` CLI.
  Use this skill whenever you're implementing, debugging, or reviewing code that
  spawns `agent acp` programmatically and needs to expose MCP tools to the agent.
  Covers: why newSession.mcpServers is ignored, how to correctly write the workspace
  mcp.json, the git-root workspace detection trap, how to set up a multi-session
  StreamableHTTP proxy, the approval hash mechanism, and a step-by-step debugging
  workflow. Trigger on phrases like "agent acp MCP", "mcp-proxy", "cursor runner MCP",
  "MCP tools not available", "agent doesn't see MCP tools", "StreamableHTTPServerTransport",
  or any question about wiring MCP servers into an ACP-based agent loop.
---

# Cursor Agent ACP + MCP Best Practices

All findings below are validated against `agent` CLI version `2026.03.11-6dfa30c`
and `@modelcontextprotocol/sdk@1.12.1`. Test them if your version differs.

---

## 1. How `agent acp` loads MCP servers

**`newSession({ mcpServers })` is silently ignored.**

Even though the ACP `NewSessionRequest` schema has a `mcpServers` field and the
agent advertises `mcpCapabilities: { http: true, sse: true }`, passing MCP servers
via the ACP protocol does not work in practice. The agent never connects to them.

**The only reliable mechanism: workspace `.cursor/mcp.json`.**

Write the MCP config file to `<workspaceRoot>/.cursor/mcp.json` **before** spawning
`agent acp`. The agent reads this file based on its detected workspace root (see §1a
below). Both stdio and HTTP URL entries are recognised:

```json
{
  "mcpServers": {
    "nanoclaw": {
      "command": "/path/to/node",
      "args": ["/path/to/ipc-mcp-stdio.js"],
      "env": { "NANOCLAW_IPC_DIR": "...", "NANOCLAW_CHAT_JID": "..." }
    },
    "mcp-proxy": {
      "url": "http://127.0.0.1:PORT"
    }
  }
}
```

Write the file, then call `preApproveMcps()` (see §3), then spawn the agent.

---

## 1a. ⚠️ Git-root workspace detection trap

**The agent CLI walks up the directory tree to the git/Cursor project root and uses
that as its workspace — regardless of `cwd` or `--workspace`.**

This is the most common cause of "MCP tools not available" when `groupDir` lives
inside a larger git repository.

**Example:** If your structure is:
```
nanoclaw-zoom/          ← git root (Cursor project)
  groups/
    main/               ← groupDir (cwd for agent)
```

Even with `spawn('agent', ['acp', '--workspace', groupDir], { cwd: groupDir })`,
the agent detects `nanoclaw-zoom/` as the workspace. Writing to
`groups/main/.cursor/mcp.json` is **silently ignored**.

**Verified behaviour:**
- `agent mcp list` run from `groups/main` only shows user-level MCPs (from
  `~/.cursor/mcp.json`), not workspace MCPs from `groups/main/.cursor/mcp.json`
- `agent mcp enable` run from `groups/main` stores approvals in
  `~/.cursor/projects/<nanoclaw-zoom-slug>/mcp-approvals.json`, not in the
  `groups/main` slug
- `--workspace groups/main` does **not** override this behaviour for MCP config

**Fix:** Write `.cursor/mcp.json` to the **git root** (project root), not to
`groupDir`. Use `NANOCLAW_PROJECT_ROOT` env var (or `process.cwd()` at the
top-level process) to find it:

```typescript
const projectRoot = process.env.NANOCLAW_PROJECT_ROOT ?? process.cwd();
const cursorDir = path.join(projectRoot, '.cursor');
fs.mkdirSync(cursorDir, { recursive: true });
fs.writeFileSync(
  path.join(cursorDir, 'mcp.json'),
  JSON.stringify({ mcpServers: { 'mcp-proxy': { url: `http://127.0.0.1:${port}` } } }, null, 2),
);
// Approve from projectRoot — that's the workspace agent actually uses
preApproveMcps(projectRoot);
// Keep --workspace groupDir to control where agent reads/writes files
spawn('agent', ['acp', '--workspace', groupDir, ...], { cwd: groupDir });
```

**Exception:** If `groupDir` is a fresh directory *outside* any git repo (e.g. a
tmpdir), the agent uses `groupDir` itself as the workspace and will read
`groupDir/.cursor/mcp.json` correctly. This is why debug scripts using `mkdtemp`
work fine.

---

## 2. StreamableHTTP server: use per-session transport instances

### What doesn't work

```typescript
// ❌ stateless — second request returns 500, agent says "Connection failed"
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

// ❌ single stateful instance — works for one connection, fails on the second
const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: randomUUID });
await server.connect(transport);
const httpServer = http.createServer((req, res) => transport.handleRequest(req, res));
```

The **stateless** mode fails because the Cursor agent sends three requests in
sequence (`POST initialize`, `POST notifications/initialized`, `GET /`) and the
stateless transport rejects the second one with 500.

The **single stateful** instance fails because the transport marks itself as
initialised after the first client connects. A second client (e.g. `agent mcp list`
followed by the actual ACP session) gets "Server already initialized".

### What works: per-session transport map

```typescript
import { randomUUID } from 'crypto';

const sessionTransports = new Map<string, StreamableHTTPServerTransport>();

const httpServer = http.createServer(async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  // Reuse existing transport for established sessions
  if (sessionId && sessionTransports.has(sessionId)) {
    await sessionTransports.get(sessionId)!.handleRequest(req, res);
    return;
  }

  // New connection → fresh transport + server pair
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (id) => {
      sessionTransports.set(id, transport);
      transport.onclose = () => sessionTransports.delete(id);
    },
  });

  const server = createServer(); // your MCP Server instance
  await server.connect(transport);
  await transport.handleRequest(req, res);
});
```

Key points:
- Route by `mcp-session-id` header for existing sessions.
- Create a **new** `StreamableHTTPServerTransport` **and** a new `Server` for
  each new session. They cannot be shared across sessions.
- Clean up on `transport.onclose` to prevent memory leaks.

### Request sequence Cursor agent sends to an HTTP MCP server

```
POST /   {"method":"initialize", ...}          → 200 SSE stream (session ID in header)
POST /   {"method":"notifications/initialized"} → 202
GET  /                                          → opens standalone SSE stream
POST /   {"method":"tools/list", ...}           → 200 SSE stream
```

The `Accept` and `Content-Type` headers sent by Cursor (version 1.0.0):
```
Content-Type: application/json
Accept: application/json, text/event-stream
```

These are correct for StreamableHTTP. If your server returns 406, the `Accept`
header is likely the problem (older MCP SDK versions were stricter).

---

## 3. MCP approval mechanism

Approvals are stored **per workspace** in:
```
~/.cursor/projects/<workspace-path-as-slug>/mcp-approvals.json
```

The workspace slug is the filesystem path with `/` replaced by `-` (leading `/`
stripped). Example: `/tmp/nanoclaw-debug-ABC/group` → `private-tmp-nanoclaw-debug-ABC-group`.

Each entry is `"{server-name}-{hash}"` where the hash is derived from the server's
configuration (URL or command+args). **If the port changes, the hash changes and
the old approval becomes invalid.**

### How to pre-approve

Pass `projectRoot` (the git root, see §1a) as `cwd` — that's the workspace the
agent actually resolves:

```typescript
function preApproveMcps(projectRoot: string): void {
  const listResult = spawnSync('agent', ['mcp', 'list'], {
    cwd: projectRoot,
    encoding: 'utf-8',
  });

  const output = (listResult.stdout + listResult.stderr)
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); // strip ANSI

  const needsApproval = output
    .split('\n')
    .filter(line => line.includes('needs approval'))
    .map(line => line.split(':')[0].trim())
    .filter(Boolean);

  for (const name of needsApproval) {
    spawnSync('agent', ['mcp', 'enable', name], {
      cwd: projectRoot,
      encoding: 'utf-8',
    });
  }
}
```

Run `preApproveMcps(projectRoot)` **after** writing `.cursor/mcp.json` and **before**
spawning `agent acp`.

### Dynamic ports and approval

If your proxy uses a dynamic port (OS-assigned via `port 0`), the hash changes on
every restart and `preApproveMcps` must be re-run every time. This is acceptable
for the nanoclaw use case where the proxy is a child process that lives only for
the ACP session's lifetime.

---

## 4. Full integration sequence

```
1. resolveConfig(groupDir)          read group mcp.json, inject runtime env
2. findFreePort()                   OS-assigned TCP port
3. write temp config → /tmp/...
4. spawnProxy(port, configPath)     spawn mcp-proxy child process
5. waitForProxy(port)               poll http://127.0.0.1:PORT/ until any response
6. write projectRoot/.cursor/mcp.json with { "mcp-proxy": { "url": "http://127.0.0.1:PORT" } }
   ⚠️  projectRoot = git root, NOT groupDir (see §1a)
7. preApproveMcps(projectRoot)      agent mcp enable for any unapproved entries
8. spawn agent acp --workspace groupDir (cwd = groupDir)
9. ACP initialize + newSession({ cwd: groupDir, mcpServers: [] })
10. prompt loop
11. finally: kill proxy, delete temp config
```

The `mcpServers: []` in step 9 is intentional — the agent loads MCP from the
workspace file written in step 6.

**Order matters for steps 4–8:**
- `waitForProxy` must complete before writing mcp.json — the agent connects to the
  proxy immediately on startup; if the proxy isn't listening yet the connection fails
  silently and tools won't be available.
- `preApproveMcps` must run after writing mcp.json — the approval hash is derived
  from the URL (including port), so approving before writing gives a stale hash.

---

## 5. Debugging workflow

When agent doesn't see MCP tools, work through these checks in order:

### Check 0 — Is groupDir inside a git repo?

```bash
git -C <groupDir> rev-parse --show-toplevel
```

If the output is a parent directory (not `groupDir` itself), the agent uses that
parent as its workspace. Your `.cursor/mcp.json` must be written there, not in
`groupDir`. See §1a.

### Check 1 — Is the file in the right place?

```bash
cat <projectRoot>/.cursor/mcp.json   # NOT groupDir/.cursor/mcp.json
```

The file must be at the git root, not the group subdirectory.

### Check 2 — Does `agent mcp list` show the entry?

```bash
cd <projectRoot> && agent mcp list
```

Run from `projectRoot`, not `groupDir`. If your MCP entry doesn't appear here,
the agent won't load it regardless of what's in `groupDir/.cursor/mcp.json`.

Look for `<name>: ready` or `<name>: needs approval`. If it doesn't appear at all,
the mcp.json path is wrong (see Check 1).

### Check 3 — Is the entry approved?

If `agent mcp list` shows `<name>: needs approval`, run:

```bash
cd <projectRoot> && agent mcp enable <name>
```

Then verify the approval was saved:

```bash
cat ~/.cursor/projects/<projectRoot-slug>/mcp-approvals.json
```

### Check 4 — Does the approval hash match?

The hash is derived from the server URL (including port) or command+args. If the
port changes between runs, the stored hash is stale. Re-run `agent mcp enable`.

### Check 5 — Does `agent mcp list` show the server as `ready` twice in a row?

```bash
cd <projectRoot> && agent mcp list   # first time
cd <projectRoot> && agent mcp list   # second time
```

If the first call succeeds but the second shows `Connection failed`, the MCP server
is using a single stateful transport (not per-session). Fix: use the per-session
transport pattern from §2.

### Check 6 — Is the HTTP server returning 200 for the initialize POST?

Add temporary logging to the server:

```typescript
const httpServer = http.createServer(async (req, res) => {
  process.stderr.write(`[mcp] ${req.method} ${req.url}\n`);
  await transport.handleRequest(req, res);
  process.stderr.write(`[mcp] response statusCode=${res.statusCode}\n`);
});
```

Expected sequence: `POST / → 200`, `POST / → 202`, `GET / → 200`.
If you see `POST / → 500`, check whether you're in stateless mode or using a
single-instance stateful transport (both are broken — see §2).

---

## 6. Quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| Agent never calls MCP tools | `newSession.mcpServers` is used | Write `.cursor/mcp.json` before spawning |
| MCP tools missing, mcp.json written to groupDir | groupDir is inside a git repo | Write to git root instead (§1a) |
| `agent mcp list` only shows user-level MCPs | mcp.json in wrong directory | Check git root path, write there |
| `agent mcp enable` saves to wrong workspace slug | Running from groupDir inside git repo | Run from projectRoot (git root) |
| `agent mcp list` shows `needs approval` | First run in new workspace | `agent mcp enable <name>` from projectRoot |
| `agent mcp list` shows `Connection failed` | Single-instance stateful transport | Per-session transport pattern (§2) |
| Second `agent mcp list` fails, first passes | Same as above | Per-session transport pattern (§2) |
| `POST /` returns 500 | Stateless transport mode | Use `sessionIdGenerator: () => randomUUID()` |
| Approval worked before but broke | Port changed → hash mismatch | Re-run `agent mcp enable` from projectRoot |
| Tools visible in `agent mcp list` but not in ACP session | Proxy not ready when agent started | Call `waitForProxy` before writing mcp.json and before spawning agent |
