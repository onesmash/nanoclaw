## Tasks

- [x] 1. In `syncMcpJson()`, remove `NANOCLAW_CHAT_JID` from the `env` object written to `mcp.json`
- [x] 2. In `main()`, add `NANOCLAW_CHAT_JID: containerInput.chatJid` to `spawnEnv` before spawning `agent acp`
- [x] 3. Run `npm run build` and confirm zero TypeScript errors
- [ ] 4. Manually verify: start two cursor sessions for different channels sharing `main` folder; confirm each session's MCP server receives the correct `chatJid` (check logs from `ipc-mcp-stdio.js`)
