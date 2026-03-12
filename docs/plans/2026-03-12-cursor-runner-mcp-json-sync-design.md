# Design: cursor-runner 同步 ipc-mcp-stdio 到 workspace mcp.json

## Problem

`cursor-runner.ts` 当前通过 ACP 协议的 `newSession`/`loadSession` 参数传递 MCP 配置，但这种方式不可靠，导致 Cursor agent 无法稳定获取 nanoclaw MCP server。

## Solution

在 spawn `agent acp` 之前，将 `ipc-mcp-stdio` MCP 配置合并写入 `{groupDir}/.cursor/mcp.json`，同时保留通过 ACP 传递的现有逻辑（belt & suspenders）。

## Design

### File Location

```
{groupDir}/.cursor/mcp.json
```

每个 group 有独立的 workspace，无并发冲突。

### Write Strategy: Merge, Not Overwrite

1. 读取 `{groupDir}/.cursor/mcp.json`（不存在则视为 `{}`）
2. 仅写入 `mcpServers.nanoclaw` 字段
3. 其他已有 MCP server 配置保持不变

### Config Format

```json
{
  "mcpServers": {
    "nanoclaw": {
      "command": "node",
      "args": ["/absolute/path/to/dist/ipc-mcp-stdio.js"],
      "env": {
        "NANOCLAW_IPC_DIR": "<process.env.NANOCLAW_IPC_DIR>",
        "NANOCLAW_CHAT_JID": "<containerInput.chatJid>",
        "NANOCLAW_GROUP_FOLDER": "<containerInput.groupFolder>",
        "NANOCLAW_IS_MAIN": "<containerInput.isMain ? '1' : '0'>"
      }
    }
  }
}
```

- `args[0]`: `mcpServerPath`（即 `path.join(__dirname, 'ipc-mcp-stdio.js')`，运行时 `__dirname` 指向 `dist/`）
- 所有 env 值在运行时解析，不写入 env var 引用

### Placement in main()

在 `mcpServerPath` 计算之后、`spawn('agent', ['acp'])` 之前写入文件：

```ts
const groupDir = process.env.NANOCLAW_GROUP_DIR ?? containerInput.groupFolder;
const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');
const mcpServers = buildMcpServers(mcpServerPath, containerInput);

// NEW: sync to workspace mcp.json
syncMcpJson(groupDir, mcpServerPath, containerInput);

// existing: spawn agent acp ...
```

### No Cleanup

文件写入后不在 `finally` 中删除。原因：
- 文件是 group workspace 私有的
- 下次同一 group 的 session 启动时会用新值覆盖 `nanoclaw` 字段
- 保留文件有助于调试

## Implementation

### New function: `syncMcpJson`

```ts
function syncMcpJson(groupDir: string, mcpServerPath: string, containerInput: ContainerInput): void {
  const cursorDir = path.join(groupDir, '.cursor');
  const mcpJsonPath = path.join(cursorDir, 'mcp.json');

  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    // file doesn't exist or invalid JSON — start fresh
  }

  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
  mcpServers['nanoclaw'] = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      NANOCLAW_IPC_DIR: process.env.NANOCLAW_IPC_DIR ?? '',
      NANOCLAW_CHAT_JID: containerInput.chatJid,
      NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
      NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    },
  };

  existing.mcpServers = mcpServers;

  fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2));
  log(`Synced nanoclaw MCP to ${mcpJsonPath}`);
}
```

## Files Changed

- `container/agent-runner/src/cursor-runner.ts` — add `syncMcpJson`, call before spawn
