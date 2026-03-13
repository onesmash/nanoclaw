## 1. Implementation

- [x] 1.1 In `cursor-runner.ts`, before the `fs.mkdirSync(cursorDir)` + `fs.writeFileSync`
  block that writes the proxy URL, add symlink detection: use `fs.lstatSync` on
  `path.join(cursorDir, 'mcp.json')`, and if `.isSymbolicLink()`, call `fs.unlinkSync`
  and log `"Broke symlink at <path>, replacing with plain file"`
- [x] 1.2 Rebuild dist: `npm run build` inside `container/agent-runner/` (or root `npm run build`)
- [ ] 1.3 Verify manually: confirm `nanoclaw-zoom/.cursor/mcp.json` is no longer a symlink
  after the next cursor-runner session, and `groups/main/.cursor/mcp.json` is NOT modified
  by the session
