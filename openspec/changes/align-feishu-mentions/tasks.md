# Tasks: Align Feishu Mention Handling

## Task List

- [x] 1.1 在 `src/channels/feishu.ts` 中新增 file-local 类型 `MentionTarget = { openId: string; name: string; key: string }`
- [x] 1.2 新增辅助函数 `escapeRegExp(s: string): string`（防止 mention name 含正则特殊字符）
- [x] 1.3 新增辅助函数 `stripMentions(text, mentions): string`，剥除每个 mention 的 `key` 和 `@name`，结果 trim
- [x] 1.4 ~~新增辅助函数 `buildMentionAtTag`~~ 改为扩展 `buildPostPayload(text, mentionTargets?)` 直接生成 `{ tag: 'at', user_id }` post elements（`<at id=...></at>` 为 card 语法，在 msg_type:post 中渲染为字面文字）
- [x] 2.1 在 `FeishuChannel` 新增属性 `private pendingMentionsByJid: Record<string, MentionTarget[]> = {}`
- [x] 2.2 在 `handleMessage` 中将 mentions 类型扩展为 `Array<{ key?: string; id?: { open_id?: string }; name?: string }>`
- [x] 2.3 在 `handleMessage` 中对 `text` 消息调用 `stripMentions`，剥除所有 mention 占位符（包括 bot mention）
- [x] 2.4 在 `handleMessage` bot mention 处理块中，补加 bot placeholder key 的剥除（`replaceAll(botKey, '')`）
- [x] 2.5 在 `handleMessage` 中检测 mention-forward（isBotMentioned && nonBotMentions.length > 0），存入 `pendingMentionsByJid[jid]`，追加系统提示
- [x] 3.1 在 `sendMessage` 开头读取并清空 `pendingMentionsByJid[jid]`
- [x] 3.2 在 `sendMessage` 的 chunk 循环中，仅对 `i === 0` 的 chunk 传入 `mentionTargets`，由 `buildPostPayload` 生成 `at` elements
- [x] 4.1 将上述所有改动同步到 `.claude/skills/add-feishu/add/src/channels/feishu.ts`
- [x] 5.1 在 `src/channels/feishu.test.ts` 新增测试：text 消息剥除 `@_user_1` key 和显示名
- [x] 5.2 新增测试：bot mention key 从 text 消息中被剥除
- [x] 5.3 新增测试：mention-forward 检测 — content 末尾追加系统提示，pendingMentionsByJid 正确写入
- [x] 5.4 新增测试：sendMessage 第一 chunk payload 包含 `{ tag: 'at', user_id }` element，后续 chunk 不含，发送后 pending 清空
- [x] 5.5 `npx vitest run src/channels/feishu.test.ts` — 全部通过
- [x] 6.1 `npm run build` 编译无错误

## Dependencies

- 1.2、1.3、1.4 依赖 1.1
- 2.2、2.3、2.4、2.5 依赖 1.x、2.1
- 3.1、3.2 依赖 2.1（pendingMentionsByJid 存在）和 buildPostPayload 签名扩展（1.4）
- 4.1 依赖所有 1.x–3.x 完成
- 5.x 依赖对应实现任务
- 6.1 可与 5.x 并行
