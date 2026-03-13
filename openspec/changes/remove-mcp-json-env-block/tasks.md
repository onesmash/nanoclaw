## Tasks

- [x] 1. `syncMcpJson()` 中，`nanoclaw` 对象去掉 `env` 字段（`container/agent-runner/src/cursor-runner.ts`）
- [x] 2. `spawnEnv` 补充 `NANOCLAW_GROUP_FOLDER: containerInput.groupFolder` 和 `NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0'`
- [x] 3. `npm run build` 确认零 TypeScript 错误
- [x] 4. 手动验证：飞书发消息让 agent 创建 task，确认 `chat_jid` 为飞书 JID
