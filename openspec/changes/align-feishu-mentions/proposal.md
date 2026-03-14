# Change: Align Feishu Mention Handling with OpenClaw

## Why

飞书 `text` 类型消息里 @提及使用占位符格式（`@_user_1`、`@_user_2`）编码在文本体中，真实显示名存储在 `message.mentions[*].name` 字段。NanoClaw 当前直接将原始文本传给 agent，agent 因此学到了占位符名称并在回复中沿用，导致群组消息中出现 `@_user_1` 这样的错误显示名。

参考实现：OpenClaw（`extensions/feishu/src/mention.ts`、`bot.ts`、`reply-dispatcher.ts`）采用三层解耦策略完整解决了此问题。

## Root Cause

`handleMessage` 中对 `text` 类型消息直接使用 `parsed.text`，未对 `message.mentions` 做任何替换或剥除处理。同时，bot 自身的 mention key（如 `@_user_1`）也未从内容中移除（现有逻辑只剥除了 post 格式的 `<at>` XML tag，text 格式无此 tag）。

## What Changes

三层对齐（对应 OpenClaw `stripBotMention` / `isMentionForwardRequest` / `reply-dispatcher` 模式）：

**Layer 1 — Inbound 剥除（text 消息）**
- 新增辅助函数 `escapeRegExp`、`stripMentions`
- 对 `text` 类型消息，从内容中剥除所有 mention 的 `key`（`@_user_N`）和 `name`（`@显示名`）
- 补全 bot mention 处理：在现有 `<at>` XML 剥除之外，同时剥除 bot 的 placeholder key

**Layer 2 — Agent 系统提示（mention-forward 场景）**
- 新增 `MentionTarget` 类型和 `pendingMentionsByJid` 状态 map
- 当消息同时 @bot 和 @其他人时，将非-bot targets 存入 `pendingMentionsByJid[jid]`，并在 content 末尾追加系统提示：`[System: Your reply will automatically @mention: <names>. Do not write @mentions yourself.]`

**Layer 3 — Outbound 自动拼 mention tag**
- 新增辅助函数 `buildMentionAtTag`（生成 `<at id=openId></at>`，post/md 格式语法）
- `sendMessage` 读取并清空 `pendingMentionsByJid[jid]`，在第一个 chunk 前缀拼入所有 target 的 `<at>` tag

## Impact

- Affected specs: `feishu-inbound-context`（ADDED 2 Requirements）、`feishu-channel`（ADDED 1 Requirement）
- Affected code: `src/channels/feishu.ts`、`src/channels/feishu.test.ts`、`.claude/skills/add-feishu/add/src/channels/feishu.ts`
- Depends on: `add-feishu-typing-indicator`（已完成）
- Design doc: `docs/plans/2026-03-14-feishu-mention-alignment-design.md`
