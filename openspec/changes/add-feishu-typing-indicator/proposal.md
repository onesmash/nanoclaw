# Change: Add Feishu Typing Indicator (正在输入提示)

## Why

飞书（Feishu）渠道当前没有"正在输入"提示。用户发送消息后，在 agent 处理期间无法感知机器人是否在响应，体验与 WhatsApp 等有 typing indicator 的渠道不一致。飞书开放平台无独立 typing API，但可通过消息表情回复（message reaction）API 模拟：在用户消息上添加 `Typing` 表情表示处理中，完成后移除。

## What Changes

- `src/channels/feishu.ts` — 实现 `setTyping`：在 `handleMessage` 中缓存每个会话最近一条消息的 `message_id`；`setTyping(jid, true)` 时调用 `im.messageReaction.create` 添加 Typing 表情；`setTyping(jid, false)` 时调用 `im.messageReaction.delete` 移除
- `src/channels/feishu.test.ts` — 添加 mock `messageReaction`，更新 setTyping 相关单元测试以覆盖有/无缓存消息的场景

## Impact

- Affected specs: `feishu-channel`（新建）
- Affected code: `src/channels/feishu.ts`、`src/channels/feishu.test.ts`
