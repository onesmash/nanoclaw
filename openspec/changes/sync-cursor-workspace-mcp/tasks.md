## 1. Implementation

- [x] 1.1 在 `cursor-runner.ts` 中添加 `syncMcpJson(groupDir, mcpServerPath, containerInput)` 函数
  - 读取 `{groupDir}/.cursor/mcp.json`（不存在则视为 `{}`）
  - 仅更新 `mcpServers.nanoclaw` 字段，保留其他键
  - 写入前确保 `.cursor/` 目录存在（`fs.mkdirSync(..., { recursive: true })`）
  - 写入失败时记录 log 但不抛出异常（不影响主流程）
- [x] 1.2 在 `main()` 中 `mcpServerPath` 计算后、`spawn('agent', ['acp'])` 前调用 `syncMcpJson`
- [x] 1.3 运行 `npm run build` 验证编译通过
