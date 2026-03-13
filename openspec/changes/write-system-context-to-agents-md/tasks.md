# Tasks: write-system-context-to-agents-md

- [x] `cursor-runner.ts`: Add `syncAgentsMd(groupDir, ctx)` — writes `buildSystemPromptAppend(ctx) ?? ''` to `{groupDir}/AGENTS.md`, logs result, swallows write errors
- [x] `cursor-runner.ts`: In `main()`, call `syncAgentsMd(groupDir, ctx)` after `loadSystemContext` and before `spawn('agent', ['acp'])`
- [x] `cursor-runner.ts`: Simplify `buildPrompt` to return `applyScheduledTaskPrefix(promptText, isScheduledTask)` only — remove `loadSystemContext` and system prefix logic
- [x] Rebuild agent-runner: `cd container/agent-runner && npm run build`
- [ ] Manual validation: send a message via Cursor backend, confirm `{groupDir}/AGENTS.md` contains system context and the prompt log shows no system prefix
