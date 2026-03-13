# Design: cursor-runner 同步 ipc-mcp-stdio 到 workspace mcp.json

## Problem

`cursor-runner.ts` 当前通过 ACP 协议的 `newSession`/`loadSession` 参数传递 MCP 配置，但这种方式不可靠，导致 Cursor agent 无法稳定获取 nanoclaw MCP server。

## Solution

在 spawn `agent acp` 之前，将 `ipc-mcp-stdio` MCP 配置合并写入 `{groupDir}/.cursor/mcp.json`，同时保留通过 ACP 传递的现有逻辑（belt & suspenders）。

## Design

### File Locations

同时写入两个路径：

```
{groupDir}/.cursor/mcp.json   # per-group workspace config
~/.cursor/mcp.json             # Cursor 全局 user-level config
```

写入内容相同。全局配置是 "last session wins"——每次 session 启动时用当前 group 的值覆盖 `nanoclaw` 字段。这确保即使 Cursor 没有打开 group workspace，也能从全局 config 获取 nanoclaw MCP server。

每个 group 有独立的 workspace，per-group 写入无并发冲突。全局 config 有理论上的并发冲突（多个 group 同时启动），但由于写入是原子的 JSON merge，最坏情况是某个 group 的值覆盖另一个，不会损坏文件。

### Write Strategy: Merge, Not Overwrite

对两个目标文件均执行相同逻辑：

1. 读取目标文件（不存在或 JSON 无效则视为 `{}`）
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
- per-group 文件是 workspace 私有的，下次 session 启动时会覆盖
- 全局文件 (`~/.cursor/mcp.json`) 是用户配置，不应删除
- 保留文件有助于调试

## Implementation

### Helper: `writeMcpJson`

提取一个可复用的 helper，对单个文件执行 merge-write：

```ts
function writeMcpJson(mcpJsonPath: string, nanoclaw: Record<string, unknown>): void {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    // file doesn't exist or invalid JSON — start fresh
  }
  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
  mcpServers['nanoclaw'] = nanoclaw;
  existing.mcpServers = mcpServers;
  fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
  fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2));
}
```

### Updated: `syncMcpJson`

构建一次 nanoclaw entry，写入两个目标：

```ts
function syncMcpJson(groupDir: string, mcpServerPath: string, containerInput: ContainerInput): void {
  const nanoclaw = {
    command: 'node',
    args: [mcpServerPath],
    env: {
      NANOCLAW_IPC_DIR: process.env.NANOCLAW_IPC_DIR ?? '',
      NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
      NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    },
  };

  const targets = [
    path.join(groupDir, '.cursor', 'mcp.json'),
    path.join(os.homedir(), '.cursor', 'mcp.json'),
  ];

  for (const mcpJsonPath of targets) {
    try {
      writeMcpJson(mcpJsonPath, nanoclaw);
      log(`Synced nanoclaw MCP to ${mcpJsonPath}`);
    } catch (err) {
      log(`Failed to sync mcp.json at ${mcpJsonPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
```

需要在文件顶部 import `os`：`import os from 'os';`

## Files Changed

- `container/agent-runner/src/cursor-runner.ts` — 新增 `writeMcpJson` helper，更新 `syncMcpJson` 写入两个目标，添加 `import os from 'os'`
