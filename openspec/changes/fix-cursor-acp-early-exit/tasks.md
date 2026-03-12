## 1. Implementation

- [x] 1.1 In `cursor-runner.ts`, after spawning `agentProc`, create an `agentExited` Promise that rejects when `agentProc` emits `close` with a non-zero exit code (or when the process exits at all before the flow completes)
- [x] 1.2 Wrap the main execution body (from `connection.initialize()` through the IPC loop) in a helper that returns a Promise, then use `Promise.race([mainFlow, agentExited])` so early exit is caught by the existing `try-catch`
- [x] 1.3 Ensure the `agentExited` rejection includes the exit code in its message: `agent acp exited with code ${code}`

## 2. Validation

- [x] 2.1 Run `npm run build` inside `container/agent-runner/` — zero TypeScript errors
- [x] 2.2 Simulate early exit: spawning `false` as the agent process — confirmed `[CAUGHT] agent acp exited with code 1` and `writeOutput`-style JSON output, no `Unsettled top-level await` warning
- [ ] 2.3 Verify normal operation still works: send a real message via Zoom, confirm response arrives as before
