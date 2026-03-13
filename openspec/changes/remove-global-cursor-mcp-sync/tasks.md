# Tasks: remove-global-cursor-mcp-sync

- [x] 1. In `src/process-runner.ts`, add `NANOCLAW_PROJECT_ROOT: process.cwd()` to the `env` object inside `buildEnv()`, alongside the other `NANOCLAW_*` vars.
- [x] 2. In `container/agent-runner/src/cursor-runner.ts`, replace `path.join(os.homedir(), '.cursor', 'mcp.json')` in the `targets` array with `path.join(process.env.NANOCLAW_PROJECT_ROOT ?? '', '.cursor', 'mcp.json')`. Keep the `groupDir` target unchanged.
- [x] 3. Remove `import os from 'os'` from `cursor-runner.ts` (no longer used).
- [x] 4. Build the host (`npm run build` at project root) and the agent-runner (`npm run build` inside `container/agent-runner/`); confirm no TypeScript errors.
- [ ] 5. Manually verify: trigger a cursor-runner session and confirm `{groupDir}/.cursor/mcp.json` and `{nanoclaw-zoom}/.cursor/mcp.json` are written; `~/.cursor/mcp.json` is not modified.
