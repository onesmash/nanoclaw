# Change: Auto-Approve nanoclaw MCP After Config Sync

## Why

`cursor agent mcp` 使用 config hash（基于 `mcp.json` 中 nanoclaw entry 的内容）来追踪 MCP server 是否已授权。每次 nanoclaw 的配置变动，hash 就会改变，导致旧的 approval 失效：

**Hash 变动的触发条件：**
- `process.execPath` 变化（node 版本升级，如 `25.6.1_1` → `26.0.0_1`）
- `mcpServerPath`（`dist/ipc-mcp-stdio.js`）路径变化（重装、迁移项目）
- env 变量变化（历史上 `NANOCLAW_CHAT_JID` 被写入，`cursor-mcp-jid-via-env` 修复后 hash 不再随 JID 变化）

当 hash 不匹配时：
- `cursor agent mcp list` 显示 `nanoclaw: not loaded (needs approval)`
- Cursor IDE 中 nanoclaw 工具不可见，需要手动点击批准
- 需要用户手动运行 `cursor agent mcp enable nanoclaw` 才能恢复

**为何 DevHelper/gitnexus 不受影响：** 它们的配置完全固定（hardcoded binary path），hash 从不变化。

**当前缓解措施：** `cursor-runner` 已添加 `--approve-mcps` flag（见 `fix-cursor-acp-spawn-flags`），使 ACP session 内始终可加载 nanoclaw。但这不能修复 IDE 视图和 `cursor agent mcp list` 的显示状态。

## What Changes

`cursor-runner.ts` 在 `syncMcpJson()` 之后，立即以 **fire-and-forget** 方式 spawn `cursor agent mcp enable nanoclaw`：

- 使用 `spawn('cursor', ['agent', 'mcp', 'enable', 'nanoclaw'], { detached: true, stdio: 'ignore' })` 并调用 `.unref()`
- CWD 继承自 cursor-runner 进程（即 nanoclaw-zoom 项目根目录），确保写入正确的 `mcp-approvals.json`
- 该命令是幂等的：若 hash 未变，它打印 "already enabled and approved" 然后退出，无副作用
- 整个过程在后台进行，不阻塞 cursor-runner 的启动流程（ACP session 使用 `--approve-mcps` 不依赖此结果）

## Impact

- Affected specs: `cursor-agent-execution` (ADDED: Auto-Approve nanoclaw MCP After Config Sync)
- Affected code: `container/agent-runner/src/cursor-runner.ts` — 在 `syncMcpJson()` 调用后新增约 5 行
- Depends on: `sync-global-cursor-mcp` (syncMcpJson 已写入 `~/.cursor/mcp.json`), `fix-cursor-acp-spawn-flags` (已添加 `--approve-mcps`)
