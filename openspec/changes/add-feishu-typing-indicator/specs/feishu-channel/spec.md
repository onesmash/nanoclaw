## ADDED Requirements

### Requirement: Feishu Typing Indicator via Message Reaction

FeishuChannel SHALL 通过飞书消息表情回复（message reaction）API 实现正在输入提示。当 orchestrator 调用 `setTyping(jid, true)` 时，在用户最近一条消息上添加 `Typing` 表情；调用 `setTyping(jid, false)` 时移除该表情，以便用户感知 agent 处理状态。

#### Scenario: 有缓存消息时添加 Typing 表情

- **WHEN** orchestrator 调用 `setTyping(jid, true)` 且该 jid 已有缓存的 `message_id`（来自最近一次 `handleMessage`）
- **THEN** FeishuChannel 调用 `im.messageReaction.create`，path 为 `{ message_id }`，data 为 `{ reaction_type: { emoji_type: 'Typing' } }`
- **AND** 将返回的 `reaction_id` 存入 `lastReactionIdByJid[jid]`

#### Scenario: 处理完成后移除 Typing 表情

- **WHEN** orchestrator 调用 `setTyping(jid, false)` 且之前已添加过 reaction
- **THEN** FeishuChannel 调用 `im.messageReaction.delete`，path 为 `{ message_id, reaction_id }`
- **AND** 清除 `lastMessageIdByJid[jid]` 与 `lastReactionIdByJid[jid]`

#### Scenario: 无缓存消息时静默忽略

- **WHEN** orchestrator 调用 `setTyping(jid, true)` 且该 jid 无缓存 `message_id`（例如尚未收到任何消息）
- **THEN** FeishuChannel 不调用任何 API，直接返回
- **AND** 不抛出异常
