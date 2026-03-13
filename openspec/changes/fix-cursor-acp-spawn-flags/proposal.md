# Change: Fix cursor-runner ACP Spawn Flags and Node Path

## Why

`use-cursor-acp` 将 cursor-runner 从 `agent --print` 改为 `agent acp` 持久进程，但迁移时遗漏了以下关键参数：

1. **`--workspace <groupDir>`** — 未指定工作区，导致 Cursor 使用进程 CWD 而非 group dir 作为项目根，rules/skills/AGENTS.md 等均从错误位置加载
2. **`--approve-mcps`** — 未传递，导致 `agent acp` 启动时不自动信任 `mcp.json` 中的 MCP server（状态显示 `nanoclaw: not loaded (needs approval)`），nanoclaw 工具无法在 ACP session 中使用
3. **`--force`** — 未传递，每次工具调用均触发权限弹窗（在无人值守的 headless 场景不可接受）
4. **`--trust`** — 未传递，cursor agent 对工作区文件的访问受限
5. **`command: 'node'` 硬编码** — `syncMcpJson` 和 `buildMcpServers` 均使用字符串 `'node'` 作为 MCP server command；在 node 路径不在 `PATH` 上的环境（如自定义 Node 安装）中会导致 MCP server 启动失败。应使用 `process.execPath`（即当前 Node 可执行路径）保持一致

这些遗漏导致 cursor-runner 无法正常工作：nanoclaw MCP 不加载、工具调用被拦截、工作区上下文错误。

`add-cursor-agent` 和 `align-cursor-runner` 规范已明确要求 `--workspace`、`--approve-mcps`、`--force`、`--trust`；`fix-subprocess-node-path` 已修复了 claude-runner 中的 `process.execPath` 问题。本变更补全 cursor-runner 的同等修复。

## What Changes

- `cursor-runner.ts`：将 spawn 参数从 `['acp']` 改为 `['acp', '--workspace', groupDir, '--approve-mcps', '--force', '--trust']`
- `cursor-runner.ts` `syncMcpJson` 中 nanoclaw entry 的 `command` 从 `'node'` 改为 `process.execPath`
- `cursor-runner.ts` `buildMcpServers` 中 `command` 从 `'node'` 改为 `process.execPath`

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: ACP Spawn Flags; MODIFIED: MCP Server Command Path)
- Affected code: `container/agent-runner/src/cursor-runner.ts` only — 3 targeted edits
- Depends on: `use-cursor-acp` (introduced `agent acp` spawn), `cursor-mcp-jid-via-env` (defines `syncMcpJson` and `buildMcpServers` structure)
