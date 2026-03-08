# Change: Fix Feishu Typing Indicator Not Cleared on New Message

## Why

飞书 typing 表情在 agent 响应后有时无法消失。复现场景：agent 处理期间用户（或系统）发送了第二条消息，此时 `handleMessage` 将 `lastMessageIdByJid[jid]` 更新为新消息 ID，但 `setTyping(false)` 仍读取 `lastMessageIdByJid[jid]`（此时已是新消息 ID），导致 `messageReaction.delete` 使用了错误的 `message_id` + 原 `reaction_id` 组合，API 调用失败，旧消息上的 Typing 表情永远不会被移除。

## Root Cause

`setTyping` 在函数开头统一读取 `messageId = this.lastMessageIdByJid[jid]`，没有区分"添加 reaction 时的消息"和"当前最新消息"。当两者不同时，删除操作引用了错误的 message_id。

## What Changes

- `src/channels/feishu.ts` — 将 `lastReactionIdByJid` 从 `Record<string, string>` 改为 `Record<string, { messageId: string; reactionId: string }>` 以同时记录反应所附着的 messageId；`setTyping(true)` 时将当时的 messageId 和 reaction_id 一起存储；`setTyping(false)` 时从该记录中读取 messageId（而非 `lastMessageIdByJid[jid]`），保证 delete 用的是创建时的正确 message_id。
- `src/channels/feishu.test.ts` — 更新 `setTyping` 相关测试，添加"处理期间收到新消息时 typing 表情仍能正常清除"场景覆盖。

## Impact

- Affected specs: `feishu-channel`（修改现有 Requirement）
- Affected code: `src/channels/feishu.ts`、`src/channels/feishu.test.ts`
- Depends on: `add-feishu-typing-indicator`（已完成）
