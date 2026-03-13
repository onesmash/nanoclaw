# Tasks: fix-cursor-mcp-workspace-root

## 1. Implementation

- [x] 1.1 In `cursor-runner.ts`, derive `projectRoot` from `process.env.NANOCLAW_PROJECT_ROOT ?? process.cwd()` (after reading `containerInput`)
- [x] 1.2 Move `waitForProxy(port)` call to before writing `.cursor/mcp.json` (was inside try block after spawning agent)
- [x] 1.3 Write `.cursor/mcp.json` to `path.join(projectRoot, '.cursor', 'mcp.json')` (was `groupDir/.cursor/mcp.json`)
- [x] 1.4 Call `preApproveMcps(projectRoot)` (was `preApproveMcps(groupDir)`)
- [x] 1.5 Keep `--workspace groupDir` on the `agent acp` spawn (controls file access scope, not MCP config)
- [x] 1.6 `npm run build` in `container/agent-runner` — zero TypeScript errors

## 2. Validation

- [x] 2.1 `agent mcp list` from `projectRoot` shows `mcp-proxy: ready` when proxy is running
- [x] 2.2 `debug-mcp-proxy.js` Test A (stdio) and Test B (HTTP proxy) both pass
- [x] 2.3 Live nanoclaw session: agent has access to nanoclaw MCP tools (`send_message`, `schedule_task`, etc.)
