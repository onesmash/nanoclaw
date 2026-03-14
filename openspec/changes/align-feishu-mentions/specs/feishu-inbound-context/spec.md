## ADDED Requirements

### Requirement: Text Message Mention Placeholder Stripping

FeishuChannel SHALL strip all mention placeholder keys and display names from inbound `text` message content before delivering to the agent, so the agent never sees Feishu-internal identifiers like `@_user_1`.

#### Scenario: Mention key and display name are stripped from text message

- **GIVEN** an inbound `text` message with content `{"text": "大家好 @_user_1 你好"}` and `mentions: [{ key: "@_user_1", name: "张三", id: { open_id: "ou_abc" } }]`
- **WHEN** `handleMessage` processes the message
- **THEN** the content delivered to the agent is `"大家好 你好"` (both `@_user_1` and `@张三` removed)
- **AND** no `@_user_N` placeholder appears in the delivered content

#### Scenario: Bot mention key is also stripped from text message

- **GIVEN** an inbound `text` message where the bot is mentioned via a placeholder key (e.g. `@_user_2`) and `mentions` includes `{ key: "@_user_2", id: { open_id: "<botOpenId>" }, name: "Bot" }`
- **WHEN** `handleMessage` processes the message
- **THEN** both `@_user_2` and `@Bot` are removed from the text content
- **AND** the TRIGGER_PATTERN prefix is added if not already present

#### Scenario: Post messages are not affected by placeholder stripping

- **GIVEN** an inbound `post` message (already parsed to Markdown by `parsePostContent`)
- **WHEN** `handleMessage` processes the message
- **THEN** `stripMentions` is not applied to the post content
- **AND** the display names from `at` elements (resolved by `parsePostContent`) are preserved as-is

### Requirement: Mention-Forward Detection and Agent System Note

FeishuChannel SHALL detect when a message mentions both the bot and at least one other user (mention-forward pattern), store the non-bot targets for outbound use, and append a system note to the agent content so the agent knows a mention will be auto-added to the reply.

#### Scenario: Mention-forward detected in group message

- **GIVEN** an inbound message with `mentions` containing the bot's `open_id` and at least one other user (e.g. `{ key: "@_user_2", name: "张三", id: { open_id: "ou_abc" } }`)
- **WHEN** `handleMessage` processes the message
- **THEN** the non-bot mention targets are stored in `pendingMentionsByJid[jid]`
- **AND** the content delivered to the agent ends with `\n\n[System: Your reply will automatically @mention: 张三. Do not write @mentions yourself.]`

#### Scenario: Multiple mention-forward targets are listed in system note

- **GIVEN** an inbound message mentions the bot plus two other users (张三, 李四)
- **WHEN** `handleMessage` processes the message
- **THEN** the system note reads `[System: Your reply will automatically @mention: 张三, 李四. Do not write @mentions yourself.]`
- **AND** both targets are stored in `pendingMentionsByJid[jid]`

#### Scenario: No mention-forward when only bot is mentioned

- **GIVEN** an inbound message mentions only the bot (no other users)
- **WHEN** `handleMessage` processes the message
- **THEN** no system note is appended
- **AND** `pendingMentionsByJid[jid]` is not set for this message

#### Scenario: No mention-forward when bot is not mentioned

- **GIVEN** an inbound message mentions other users but not the bot
- **WHEN** `handleMessage` processes the message
- **THEN** no system note is appended
- **AND** `pendingMentionsByJid[jid]` is not set for this message
