# Tasks: Add Feishu Typing Indicator

## Task List

- [x] 1.1 在 `FeishuChannel` 中添加 `lastMessageIdByJid`、`lastReactionIdByJid` 缓存字段
- [x] 1.2 在 `handleMessage` 中，在调用 `onMessage` 前缓存 `msgId` 到 `lastMessageIdByJid[jid]`
- [x] 2.1 实现 `setTyping(jid, true)`：若有缓存 `messageId` 则调用 `client.im.messageReaction.create`，`emoji_type: 'Typing'`，存储返回的 `reaction_id`
- [x] 2.2 实现 `setTyping(jid, false)`：调用 `messageReaction.delete` 移除 reaction，并清除缓存
- [x] 3.1 在 `feishu.test.ts` mock 中增加 `im.messageReaction.create`、`im.messageReaction.delete`
- [x] 3.2 添加 setTyping 单元测试：无缓存时不调用 API；有缓存时验证 create/delete 调用参数
- [x] 4.1 `npm run build` 编译验证无错误
- [x] 4.2 `npx vitest run src/channels/feishu.test.ts` 全部通过

## Dependencies

- 1.2 依赖 1.1
- 2.1 依赖 1.1、1.2
- 2.2 依赖 2.1
- 3.2 依赖 3.1、2.1、2.2
