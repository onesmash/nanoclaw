# Feishu Mention Handling — OpenClaw Alignment

Date: 2026-03-14

## Problem

Feishu `text` type messages encode @mentions as placeholder keys (`@_user_1`,
`@_user_2`) in the text body. Real display names live in `message.mentions[*].name`.
NanoClaw passed raw text to the agent unchanged, so the agent learned placeholder
names and echoed them back in replies.

## Design

Align with OpenClaw's three-layer approach (`extensions/feishu/src/mention.ts`,
`bot.ts`, `reply-dispatcher.ts`).

### Layer 1 — Inbound: strip all mention placeholders

For `text` messages, strip both the placeholder key (`@_user_1`) **and** the
display name (`@张三`) for every entry in `message.mentions` using
`stripMentions`. This prevents the agent from ever seeing internal keys.

`post` messages are unaffected — `parsePostContent` already converts `at`
elements to display names; no further stripping is needed.

Bot mention handling is also strengthened: the bot's own placeholder key is
stripped in addition to the existing `<at>` XML tag removal (which only worked
for post-format messages).

### Layer 2 — Agent system note (mention-forward only)

When a message mentions **both the bot and at least one other user** (the
"mention-forward" pattern), the non-bot targets are stored in
`pendingMentionsByJid` and a system note is appended to the content:

```
[System: Your reply will automatically @mention: 张三. Do not write @mentions yourself.]
```

This keeps the agent's text clean while ensuring the right people get notified.

### Layer 3 — Outbound: auto-prepend `<at>` tags

`sendMessage` reads and clears `pendingMentionsByJid[jid]` before sending. On
the first chunk, it prepends Feishu `post/md` mention tags:

```
<at id=ou_xxx></at> <agent reply text…>
```

Subsequent chunks (if the reply was split) are sent without mentions.

## New helpers (file-local)

```typescript
type MentionTarget = { openId: string; name: string; key: string };

function escapeRegExp(s: string): string
function stripMentions(text: string, mentions: Array<{key:string;name:string}>): string
function buildMentionAtTag(target: MentionTarget): string  // → `<at id=openId></at>`
```

## Changes

All changes are confined to `src/channels/feishu.ts` (and the mirror copy in
`add-feishu/add/src/channels/feishu.ts`).

| # | Location | Change |
|---|----------|--------|
| 1 | file-local types | Add `MentionTarget` |
| 2 | helper functions | Add `escapeRegExp`, `stripMentions`, `buildMentionAtTag` |
| 3 | `FeishuChannel` | Add `pendingMentionsByJid: Record<string, MentionTarget[]>` |
| 4 | `handleMessage` | Extend mention type; strip all placeholders (text); detect mention-forward; store targets + append system note |
| 5 | `sendMessage` | Read/clear pending mentions; prepend `<at>` tags to first chunk |

No new files, no interface changes, no new dependencies.

## Trigger condition

Outbound auto-mention and the system note only fire when **bot + at least one
other user** are both mentioned (same as OpenClaw's `isMentionForwardRequest`).
Plain messages with no non-bot mentions are unaffected.
