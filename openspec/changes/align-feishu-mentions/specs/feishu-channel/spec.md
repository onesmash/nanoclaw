## ADDED Requirements

### Requirement: Outbound Mention-Forward Auto-Prepend

FeishuChannel SHALL prepend Feishu `at` elements to the first chunk of a reply when pending mention targets exist for that jid, so that the bot's reply automatically @mentions the forwarded users using the correct Feishu `msg_type: post` paragraph element syntax (`{ tag: 'at', user_id: openId }`).

#### Scenario: Pending mention targets are prepended to first chunk

- **GIVEN** `pendingMentionsByJid[jid]` contains `[{ openId: "ou_abc", name: "张三", key: "@_user_1" }]`
- **WHEN** `sendMessage(jid, "消息内容")` is called
- **THEN** the first chunk's post payload paragraph is `[{ tag: 'at', user_id: 'ou_abc' }, { tag: 'md', text: '消息内容' }]`
- **AND** `pendingMentionsByJid[jid]` is cleared after reading

#### Scenario: Multiple targets are prepended in order

- **GIVEN** `pendingMentionsByJid[jid]` contains two targets (ou_abc, ou_def)
- **WHEN** `sendMessage(jid, text)` is called
- **THEN** the first chunk's paragraph starts with `{ tag: 'at', user_id: 'ou_abc' }` then `{ tag: 'at', user_id: 'ou_def' }` followed by the `md` element
- **AND** all targets are cleared from `pendingMentionsByJid[jid]`

#### Scenario: Only first chunk receives mention elements on multi-chunk reply

- **GIVEN** pending mention targets exist and `sendMessage` splits text into 3 chunks
- **WHEN** the chunks are sent
- **THEN** only the first chunk's paragraph includes the `at` elements
- **AND** subsequent chunks are sent as `[{ tag: 'md', text }]` without any `at` elements

#### Scenario: No pending mentions leaves sendMessage unchanged

- **GIVEN** `pendingMentionsByJid[jid]` is empty or unset
- **WHEN** `sendMessage(jid, text)` is called
- **THEN** chunks are sent without any prepended `<at>` tags
- **AND** existing thread-reply and withdrawn-fallback behaviour is unaffected
