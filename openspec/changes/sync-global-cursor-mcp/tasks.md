## 1. Implementation

- [x] 1.1 Add `import os from 'os'` to `container/agent-runner/src/cursor-runner.ts`
- [x] 1.2 Extract `writeMcpJson(mcpJsonPath: string, nanoclaw: Record<string, unknown>): void` helper
  - Reads existing file (treats missing/invalid JSON as `{}`)
  - Sets `mcpServers.nanoclaw = nanoclaw`
  - Creates parent directory if needed (`fs.mkdirSync(..., { recursive: true })`)
  - Writes formatted JSON
- [x] 1.3 Refactor `syncMcpJson` to use `writeMcpJson` for both targets:
  - `path.join(groupDir, '.cursor', 'mcp.json')`
  - `path.join(os.homedir(), '.cursor', 'mcp.json')`
  - Each target wrapped in its own `try/catch` — failure logged, does not abort
- [x] 1.4 Run `npm run build` and verify compilation passes
