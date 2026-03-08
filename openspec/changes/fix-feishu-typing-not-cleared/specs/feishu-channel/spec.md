## MODIFIED Requirements

### Requirement: Feishu Typing Indicator 清除时使用创建时的 message_id

FeishuChannel 在存储 reaction 信息时，SHALL 同时记录添加 reaction 时所对应的 `message_id`，以确保 `setTyping(false)` 始终在正确的消息上执行删除操作，不受后续消息到达的影响。

#### Scenario: 处理期间收到新消息，typing 表情仍能正常清除

- **GIVEN** `setTyping(jid, true)` 已在消息 A（`msg_A`）上添加 Typing 表情，并记录 `reaction_id`
- **WHEN** 在 agent 完成前用户发送消息 B（`msg_B`），`handleMessage` 将 `lastMessageIdByJid[jid]` 更新为 `msg_B`
- **AND** orchestrator 随后调用 `setTyping(jid, false)`
- **THEN** FeishuChannel 调用 `im.messageReaction.delete`，path 为 `{ message_id: msg_A, reaction_id: <原 reaction_id> }`（使用创建时的 message_id，而非当前 lastMessageIdByJid）
- **AND** Typing 表情成功从消息 A 上移除

#### Scenario: 正常流程（无新消息）不受影响

- **GIVEN** `setTyping(jid, true)` 在消息 A 上添加 Typing 表情
- **WHEN** 无新消息到来，orchestrator 调用 `setTyping(jid, false)`
- **THEN** FeishuChannel 调用 `im.messageReaction.delete`，path 为 `{ message_id: msg_A, reaction_id: <reaction_id> }`
- **AND** 行为与修复前一致
