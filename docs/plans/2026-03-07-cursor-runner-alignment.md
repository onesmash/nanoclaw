# Design: cursor-runner.ts Alignment with claude-runner.ts

## Context

`cursor-runner.ts` 是 `container/agent-runner/` 包内的 Cursor CLI headless 适配层，与 `claude-runner.ts` 并列。初始实现存在多处与 `claude-runner.ts` 不一致的地方，本文档记录需要对齐的变更。

## 发现的差距

### Bug：`-p` 参数传参错误

当前代码把 `-p <prompt>` 当作带值参数使用：

```typescript
const args = ['-p', containerInput.prompt, ...]
```

但 `agent --help` 显示 `-p` / `--print` 是一个布尔标志，prompt 是位置参数：

```
Arguments:
  prompt                       Initial prompt for the agent
Options:
  -p, --print                  Print responses to console
```

### 功能缺口

| 功能 | claude-runner | cursor-runner |
|------|--------------|---------------|
| **多轮 IPC 对话循环** | `waitForIpcMessage()` + while 循环，单次容器内持续接收消息 | 只是单次 spawn，结束即退出 |
| secrets 注入 | `containerInput.secrets` 合并到 SDK env | 缺失 |
| isScheduledTask 前缀 | `[SCHEDULED TASK]` 前缀 | 缺失 |
| Close sentinel 清理 | 启动时 unlink `_close`，查询中轮询检测 | 缺失 |
| Pending IPC drain | 启动时把积压消息追加到初始 prompt | 缺失 |
| 系统提示注入 | BOOTSTRAP.md / TOOLS.md / identity / global CLAUDE.md | 缺失 |
| additionalDirectories | Claude SDK `additionalDirectories` 参数 | 缺失 |
| MCP 配置位置 | SDK 内联配置 | 只写了工作区 `.cursor/mcp.json` |
| 错误时携带 newSessionId | error output 带 `newSessionId` | 缺失 |
| 日志计数 | `messageCount` / `resultCount` 计数 | 缺失 |

## 设计方案

### 1. 多轮 IPC 对话循环

claude-runner 通过 MessageStream + async iterator 在同一 SDK 调用内注入新消息。Cursor CLI 无法做到这一点，但可以通过**重复 spawn + `--resume`** 实现等价语义：

```
main():
  let sessionId = containerInput.sessionId

  while (true):
    prompt = buildPrompt(containerInput, currentPromptText)
    { newSessionId } = await spawnAgent(prompt, sessionId, spawnEnv)
    if newSessionId: sessionId = newSessionId

    writeOutput({ status: 'success', result: null, newSessionId: sessionId })

    nextMessage = await waitForIpcMessage()   ← 轮询 IPC_INPUT_DIR + _close
    if nextMessage === null:
      break   ← close sentinel，退出
    currentPromptText = nextMessage
```

`waitForIpcMessage`、`drainIpcInput`、`shouldClose` 从 `claude-runner.ts` 提取到 `shared.ts`，两个 runner 共同引用，避免重复。

**`shared.ts` 新增导出：**

```typescript
export const IPC_POLL_MS = 500;

export function shouldClose(ipcInputCloseSentinel: string): boolean { ... }
export function drainIpcInput(ipcInputDir: string): string[] { ... }
export function waitForIpcMessage(ipcInputDir: string, ipcInputCloseSentinel: string): Promise<string | null> { ... }
```

**`claude-runner.ts`** 删除三个函数的本地定义，改为从 `shared.ts` import。

关键差异：claude-runner 在 SDK query 进行中也能实时注入消息，cursor-runner 只在每次 spawn 结束后才接收下一条消息。这对于等待 agent 完成后再回复的场景是可接受的。

### 2. 日志计数

在 `handleEvent` 中添加计数器，与 claude-runner 风格一致：

```typescript
let messageCount = 0;
let resultCount = 0;

// handleEvent 入口处：
messageCount++;
log(`[msg #${messageCount}] type=${type}`);

// result 处理处：
resultCount++;
log(`Result #${resultCount}: isError=${isError}`);
```

### 3. 配置文件管理

将 `writeMcpConfig` 重构为 `writeConfigs`，负责写两个文件：

**`~/.cursor/mcp.json`（全局）**

Cursor CLI 从全局路径读取 MCP 配置。写入前检查文件是否已存在并备份内容，agent 退出后在 `finally` 块中删除或恢复。

```typescript
const GLOBAL_CURSOR_DIR = path.join(os.homedir(), '.cursor');
const GLOBAL_MCP_PATH = path.join(GLOBAL_CURSOR_DIR, 'mcp.json');
```

**`<groupDir>/.cursor/sandbox.json`（工作区）**

Cursor 沙箱配置，用于声明额外可读写路径（等价于 Claude SDK 的 `additionalDirectories`）。读取 `NANOCLAW_EXTRA_DIR` 下所有子目录作为 `additionalReadwritePaths`。

```json
{
  "additionalReadwritePaths": ["/path/to/extra/dir1", "/path/to/extra/dir2"]
}
```

此文件无需清理，可持久保留在工作区。

**退出清理策略：**

```typescript
let previousMcpContent: string | null = null;

function writeConfigs(...) {
  // 备份旧内容
  if (fs.existsSync(GLOBAL_MCP_PATH)) {
    previousMcpContent = fs.readFileSync(GLOBAL_MCP_PATH, 'utf-8');
  }
  // 写新内容
  ...
}

function cleanupConfigs() {
  if (previousMcpContent !== null) {
    fs.writeFileSync(GLOBAL_MCP_PATH, previousMcpContent);
  } else {
    try { fs.unlinkSync(GLOBAL_MCP_PATH); } catch { /* ignore */ }
  }
}

// main 中：
try {
  await spawnAgent(...);
} finally {
  cleanupConfigs();
}
```

### 4. Prompt 构建

文件读取逻辑提取到 `shared.ts`，两个 runner 共用：

**`shared.ts` 新增导出：**

```typescript
export interface SystemContext {
  identityContent?: string;
  globalClaudeMd?: string;
  bootstrapContent?: string;
  toolsContent?: string;
  extraDirs: string[];
}

export function loadSystemContext(containerInput: ContainerInput): SystemContext { ... }

export function applyScheduledTaskPrefix(prompt: string, isScheduledTask?: boolean): string { ... }
```

**`claude-runner.ts`** 删除本地文件读取逻辑，改为：

```typescript
const ctx = loadSystemContext(containerInput);
const parts = [ctx.identityContent, ctx.globalClaudeMd, ctx.bootstrapContent, ctx.toolsContent].filter(Boolean);
// 继续拼成 SDK systemPrompt append 格式（不变）
```

**`cursor-runner.ts`** 使用相同函数，组装为文本前缀：

```typescript
const ctx = loadSystemContext(containerInput);
const systemPrefix = [ctx.identityContent, ctx.globalClaudeMd, ctx.bootstrapContent, ctx.toolsContent]
  .filter(Boolean).join('\n\n');
let prompt = applyScheduledTaskPrefix(containerInput.prompt, containerInput.isScheduledTask);
if (systemPrefix) prompt = `${systemPrefix}\n\n---\n\n${prompt}`;
```

**修复后的 spawn args：**

```typescript
const args = [
  prompt,                        // 位置参数（修复 bug）
  '--print',                     // boolean flag
  '--output-format', 'stream-json',
  '--stream-partial-output',
  '--force',
  '--trust',
  '--approve-mcps',
  '--workspace', groupDir,
];

if (containerInput.sessionId) {
  args.unshift('--resume', containerInput.sessionId);
}
```

### 5. main 函数对齐

```
main():
  1. 读 stdin → containerInput

  2. 构建 spawnEnv = { ...process.env, ...containerInput.secrets }

  3. writeConfigs(groupDir, mcpServerPath, containerInput)
     → 备份并写入 ~/.cursor/mcp.json
     → 写入 groupDir/.cursor/sandbox.json

  4. 清理 close sentinel：try { unlink(IPC_INPUT_CLOSE_SENTINEL) } catch {}

  5. drain 积压 IPC 消息追加到 prompt

  6. prompt = buildPrompt(containerInput)
     if pending.length > 0: prompt += '\n' + pending.join('\n')

  7. try {
       await spawnAgent(prompt, spawnEnv, ...)
     } finally {
       cleanupConfigs()
     }

  8. catch 块里 error output 带 newSessionId（如已捕获）
```

## Files Changed

| 文件 | 改动 |
|------|------|
| `container/agent-runner/src/shared.ts` | 新增导出：`shouldClose`、`drainIpcInput`、`waitForIpcMessage`、`IPC_POLL_MS`、`loadSystemContext`、`applyScheduledTaskPrefix` |
| `container/agent-runner/src/claude-runner.ts` | 删除 IPC 函数和文件读取本地定义，改从 `shared.ts` import |
| `container/agent-runner/src/cursor-runner.ts` | 全部对齐变更，重构 `writeMcpConfig` → `writeConfigs` |

## Risks

- **`~/.cursor/mcp.json` 并发写入**：如果同时有多个 cursor-runner 实例运行（并发任务），它们会互相覆盖 mcp.json。当前 NanoClaw 不支持同组并发，跨组并发时每个写入内容相同（相同 mcpServerPath 和 env 结构），风险较低，但需注意。
- **`agent --help` 格式变更**：`-p` / `--print` 的语义确认来自当前版本，升级 Cursor CLI 后需验证。
