# Tasks: Fix Feishu Typing Indicator Not Cleared

## Task List

- [x] 1.1 将 `lastReactionIdByJid` 类型从 `Record<string, string>` 改为 `Record<string, { messageId: string; reactionId: string }>`
- [x] 1.2 在 `setTyping(true)` 中将 `{ messageId, reactionId }` 同时写入 `lastReactionIdByJid[jid]`（messageId 取自调用时的 `lastMessageIdByJid[jid]`，而非留到 false 时再读）
- [x] 1.3 在 `setTyping(false)` 中从 `lastReactionIdByJid[jid]` 读取 `{ messageId, reactionId }`，用 `messageId`（创建时）而非 `lastMessageIdByJid[jid]`（可能已更新）构造 delete 请求
- [x] 2.1 在 `feishu.test.ts` 添加场景：setTyping(true) → 新消息到来 → setTyping(false) 验证 delete 使用原 message_id
- [x] 2.2 `npx vitest run src/channels/feishu.test.ts` — 新增测试全部通过（2个预存在失败与本次变更无关）
- [x] 3.1 `npm run build` 编译无错误

## Dependencies

- 1.2 依赖 1.1
- 1.3 依赖 1.1、1.2
- 2.1 依赖 1.2、1.3
- 2.2 依赖 2.1
- 3.1 可与 2.x 并行
