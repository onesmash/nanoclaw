## ADDED Requirements

### Requirement: IPC Input Message JID Isolation
当多个 agent container 共享同一个 `NANOCLAW_IPC_DIR`（因为它们对应的群组注册到同一 folder），`GroupQueue` 写入 IPC input 目录的 follow-up 消息 SHALL 携带目标 `chatJid`，container 只消费与自身 `chatJid` 匹配的消息，以防止消息被错误 container 劫持并路由到错误渠道。

#### Scenario: Same-folder channels do not steal each other's piped messages
- **GIVEN** two channels (e.g., Zoom DM `zoom:dm:X` and Feishu `fs:p_Y`) are registered to the same folder (`main`), both containers running and polling `data/ipc/main/input/`
- **WHEN** `GroupQueue.sendMessage('zoom:dm:X', text)` writes a follow-up message to `data/ipc/main/input/`
- **THEN** the written file contains `{ type: 'message', text, chatJid: 'zoom:dm:X' }`
- **AND** the Feishu container (`chatJid = 'fs:p_Y'`) skips (does not delete) that file
- **AND** the Zoom container (`chatJid = 'zoom:dm:X'`) consumes and processes the file
- **AND** the reply is sent to the Zoom channel

#### Scenario: Backward compatibility — untagged messages are consumed by any container
- **GIVEN** an IPC input file exists without a `chatJid` field (written by an older version)
- **WHEN** any container calls `drainIpcInput()`
- **THEN** the file is consumed regardless of the container's own `chatJid`
- **AND** the message text is included in the prompt

#### Scenario: Single-channel deployment is unaffected
- **GIVEN** only one channel is registered (no folder sharing)
- **WHEN** `GroupQueue.sendMessage()` writes a follow-up message
- **THEN** the single running container consumes the message normally
- **AND** behavior is identical to the pre-fix implementation
