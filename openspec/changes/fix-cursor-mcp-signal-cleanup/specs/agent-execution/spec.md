# Capability: agent-execution

## MODIFIED Requirements

### Requirement: Cursor Runner Global MCP Config

`cursor-runner.ts` SHALL 在 spawn `agent` 前将 MCP server 配置写入 `~/.cursor/mcp.json`（全局路径），agent 退出后在 `finally` 块中恢复原文件内容（若原文件存在）或删除该文件。

为确保进程因信号终止时也能完成清理，`cursor-runner.ts` SHALL 在模块加载时注册 `SIGTERM`、`SIGINT` 信号处理器，在 `process.exit(0)` 之前同步调用 `cleanupConfigs()`。同时注册 `process.on('exit', cleanupConfigs)` 作为兜底，覆盖 `process.exit()` 直接调用等场景。

#### Scenario: 写入全局 MCP 配置

- **WHEN** `cursor-runner` 在 spawn 前写入 `~/.cursor/mcp.json`
- **THEN** Cursor CLI 全局 MCP 配置包含 nanoclaw IPC server

#### Scenario: 退出后恢复原配置

- **WHEN** spawn 前 `~/.cursor/mcp.json` 已存在
- **THEN** agent 退出后文件内容恢复为原始内容

#### Scenario: 退出后删除新建文件

- **WHEN** spawn 前 `~/.cursor/mcp.json` 不存在
- **THEN** agent 退出后删除该文件

#### Scenario: SIGTERM 信号触发清理

- **WHEN** 进程收到 SIGTERM 信号（如 launchctl stop 或 kill）
- **THEN** `cleanupConfigs()` 在进程退出前同步执行，`~/.cursor/mcp.json` 恢复为原始状态或被删除

#### Scenario: SIGINT 信号触发清理

- **WHEN** 进程收到 SIGINT 信号（如 Ctrl+C）
- **THEN** `cleanupConfigs()` 在进程退出前同步执行，`~/.cursor/mcp.json` 恢复为原始状态或被删除
