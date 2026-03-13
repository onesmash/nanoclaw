# Design: Embedded MCP Proxy in cursor-runner

**Date:** 2026-03-13
**Status:** Draft
**Risk:** LOW (contained within cursor-runner.ts and a new mcp-proxy.py)

## Problem

Cursor ACP's `newSession({ mcpServers })` does not spawn stdio-based MCP processes. It only *connects* to already-running HTTP/SSE endpoints. When `cursor-runner.ts` passes a `McpServerStdio` config (with `command`/`args`/`env`), Cursor silently ignores the spawn — no MCP tools are available to the agent.

Additionally, each group can have its own `mcp.json` defining multiple MCP servers (e.g. `nanoclaw`, `peekaboo`, `context7`). These need full lifecycle control — start before the session, stop after.

## Goal

cursor-runner owns the full lifecycle of all MCP servers defined in the group's `mcp.json`: spawn them before the ACP session, expose them as a single HTTP endpoint, and kill them when the session ends.

## Approach

**cursor-runner spawns a fastmcp Python proxy that aggregates all group MCP servers, then passes a single `McpServerHttp` to ACP.**

1. cursor-runner reads the group's `mcp.json` (`<groupDir>/.cursor/mcp.json`).
2. cursor-runner resolves the `nanoclaw` entry's `env` block with runtime values (NANOCLAW_IPC_DIR, NANOCLAW_CHAT_JID, etc.) — overwriting any stale hardcoded values.
3. cursor-runner picks a free local port and writes the resolved config to a temp file.
4. cursor-runner spawns `mcp-proxy.py <port> <config-file>` as a child process.
5. `mcp-proxy.py` reads the config, calls `FastMCP.mount(create_proxy(...), namespace=name)` for each server, and runs `transport="streamable-http"` on `127.0.0.1:<port>`.
6. cursor-runner polls `http://127.0.0.1:<port>/health` (or any endpoint) until ready, then builds `McpServerHttp`.
7. ACP `newSession` / `loadSession` receives `[{ type: 'http', name: 'mcp-proxy', url: 'http://127.0.0.1:<port>' }]`.
8. On exit (`finally` block), cursor-runner kills the proxy child process and deletes the temp config file.

## Components

### `mcp-proxy.ts` (new file, lives alongside cursor-runner)

Pure Node.js, zero new dependencies — uses `@modelcontextprotocol/sdk` already present.

```typescript
// Usage: node mcp-proxy.js <port> <config-json-path>
import http from 'http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

type McpServerEntry =
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { url: string };

function buildClientTransport(entry: McpServerEntry): Transport {
  if ('command' in entry) {
    return new StdioClientTransport({ command: entry.command, args: entry.args, env: entry.env, stderr: 'pipe' });
  }
  return new StreamableHTTPClientTransport(new URL(entry.url));
}

async function buildProxy(config: { mcpServers: Record<string, McpServerEntry> }, port: number) {
  const proxy = new McpServer({ name: 'mcp-proxy', version: '1.0.0' });

  for (const [name, entry] of Object.entries(config.mcpServers)) {
    const client = new Client({ name, version: '1.0.0' });
    await client.connect(buildClientTransport(entry));
    const { tools } = await client.listTools();
    for (const tool of tools) {
      proxy.tool(`${name}__${tool.name}`, tool.description ?? '', tool.inputSchema as any,
        async (args) => client.callTool({ name: tool.name, arguments: args }));
    }
  }

  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = http.createServer((req, res) => transport.handleRequest(req, res));
  await proxy.connect(transport);
  server.listen(port, '127.0.0.1');
}

const [,, port, configPath] = process.argv;
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
await buildProxy(config, parseInt(port));
```

### `cursor-runner.ts` changes

- `findFreePort()`: opens TCP server on port 0, reads assigned port, closes it.
- `resolveConfig(groupDir, containerInput)`: reads `<groupDir>/.cursor/mcp.json`, merges runtime env into the `nanoclaw` entry, returns resolved config object.
- `spawnProxy(port, configPath)`: spawns `python3 mcp-proxy.py <port> <configPath>`, pipes stderr to log, returns `ChildProcess`.
- `waitForProxy(port, timeout)`: polls `http://127.0.0.1:<port>/` until any response or timeout.
- `main()`: resolve config → write temp file → spawn proxy → wait ready → create ACP session → run prompts → kill proxy + delete temp file in `finally`.
- Remove `buildMcpServers()` (stdio variant) and `syncMcpJson()`.

## Data Flow

```
cursor-runner.main()
  ├─ resolveConfig(groupDir) → merged mcp.json (nanoclaw env injected at runtime)
  ├─ write /tmp/nanoclaw-mcp-<groupFolder>-<port>.json
  ├─ findFreePort() → 49312
  ├─ spawnProxy(49312, tmpFile) → ChildProcess
  │    └─ mcp-proxy.py reads config
  │         ├─ mount(nanoclaw) → spawns ipc-mcp-stdio via stdio
  │         ├─ mount(peekaboo) → spawns peekaboo mcp via stdio
  │         └─ run(http, 127.0.0.1:49312)
  ├─ waitForProxy(49312) → ok
  ├─ connection.newSession({ mcpServers: [{ type:'http', url:'http://127.0.0.1:49312' }] })
  │    └─ Cursor connects via HTTP ✓
  ├─ connection.prompt(...)
  │    └─ Agent calls nanoclaw__send_message → POST 127.0.0.1:49312 → proxy → ipc-mcp-stdio
  └─ finally: proxyProc.kill(), fs.unlinkSync(tmpFile)
```

## Tool Naming

fastmcp automatically prefixes tools with the namespace: `nanoclaw__send_message`, `peekaboo__screenshot`. No collision possible. The agent sees all tools from all servers through the single endpoint.

## Runtime Env Injection

The `nanoclaw` entry in `mcp.json` may have stale hardcoded env values. cursor-runner overwrites them before writing the temp file:

```typescript
function resolveConfig(groupDir: string, containerInput: ContainerInput) {
  const mcpJsonPath = path.join(groupDir, '.cursor', 'mcp.json');
  const config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  if (config.mcpServers?.nanoclaw) {
    config.mcpServers.nanoclaw.env = {
      ...config.mcpServers.nanoclaw.env,
      NANOCLAW_IPC_DIR: process.env.NANOCLAW_IPC_DIR ?? '',
      NANOCLAW_CHAT_JID: containerInput.chatJid,
      NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
      NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    };
  }
  return config;
}
```

## Why Not Other Options

**Option: pass McpServerStdio per-server to ACP** — ACP ignores stdio configs at runtime; confirmed by reading SDK source.

**Option: restore syncMcpJson** — race condition when multiple groups run simultaneously (last writer wins on shared `mcp.json`). Also only takes effect at Cursor workspace load, not per ACP session.

**Option: Node.js proxy instead of fastmcp** — fastmcp has 23k stars and handles stdio spawning, lifecycle, and tool namespacing out of the box. Writing an equivalent in Node.js is non-trivial and not worth it.

## Constraints

- Zero new dependencies: `@modelcontextprotocol/sdk` (with `StdioClientTransport`, `StreamableHTTPClientTransport`, `StreamableHTTPServerTransport`) is already installed.
- `mcp-proxy.ts` compiles to `mcp-proxy.js` alongside the other agent-runner JS files.
- Port is OS-assigned (port 0), no hardcoded port conflicts.
- Proxy binds to `127.0.0.1` only — not exposed on the network.
- Temp config file is deleted in `finally` even on error.
- `command`/`args`/`env` entries → `StdioClientTransport`; `url` entries → `StreamableHTTPClientTransport`.
- If `mcp.json` does not exist for a group, cursor-runner falls back to a nanoclaw-only default config.
