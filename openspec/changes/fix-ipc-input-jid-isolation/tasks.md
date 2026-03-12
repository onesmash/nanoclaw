## 1. Implementation

- [ ] 1.1 在 `src/group-queue.ts` 的 `sendMessage()` 中，写入 IPC 文件时加入 `chatJid: groupJid` 字段
- [ ] 1.2 在 `container/agent-runner/src/shared.ts` 的 `drainIpcInput(ipcInputDir, chatJid?)` 中，增加可选 `chatJid` 参数；当参数存在时，跳过（不删除）`data.chatJid` 与之不匹配的文件；无 `chatJid` 字段的旧文件视为匹配（向后兼容）
- [ ] 1.3 在 `container/agent-runner/src/shared.ts` 的 `waitForIpcMessage(ipcInputDir, closeSentinel, chatJid?)` 中，将 `chatJid` 透传给内部的 `drainIpcInput()` 调用
- [ ] 1.4 在 `container/agent-runner/src/claude-runner.ts` 中，向 `drainIpcInput()` 和 `waitForIpcMessage()` 传入 `containerInput.chatJid`；更新 `runQuery()` 以透传该参数
- [ ] 1.5 在 `container/agent-runner/src/cursor-runner.ts` 中，向 `drainIpcInput()` 和 `waitForIpcMessage()` 传入 `containerInput.chatJid`

## 2. Validation

- [ ] 2.1 运行 `npm run build` — 零 TypeScript 错误
- [ ] 2.2 运行 `cd container/agent-runner && npm run build` — 零 TypeScript 错误
- [ ] 2.3 运行 `npm test` — 所有测试通过
- [ ] 2.4 发送 Zoom 消息，确认回复路由到 Zoom 渠道
- [ ] 2.5 发送飞书消息，确认回复路由到飞书渠道
- [ ] 2.6 同时发送 Zoom 和飞书消息，确认各自回复到正确渠道（无交叉路由）
