## 1. process-runner.ts

- [x] 1.1 在 `buildEnv()` 中新增 `NANOCLAW_SOUL_PATH: path.join(GROUPS_DIR, 'main', 'SOUL.md')`
- [x] 1.2 在 `buildEnv()` 中新增 `NANOCLAW_USER_PATH: path.join(GROUPS_DIR, 'main', 'USER.md')`

## 2. shared.ts

- [x] 2.1 `SystemContext` 接口新增 `soulContent?: string` 和 `userContent?: string` 字段
- [x] 2.2 `loadSystemContext` 中读取 `NANOCLAW_SOUL_PATH`、`NANOCLAW_USER_PATH`（文件不存在则 undefined）
- [x] 2.3 新增 `buildSystemPromptAppend(ctx: SystemContext): string | undefined`，拼接顺序：SOUL → IDENTITY → USER → CLAUDE.md → BOOTSTRAP → TOOLS

## 3. claude-runner.ts

- [x] 3.1 import `buildSystemPromptAppend` from `./shared.js`
- [x] 3.2 用 `buildSystemPromptAppend(ctx)` 替换内联 `parts` 数组拼接

## 4. cursor-runner.ts

- [x] 4.1 import `buildSystemPromptAppend` from `./shared.js`
- [x] 4.2 `buildPrompt()` 中用 `buildSystemPromptAppend(ctx)` 替换内联数组拼接

## 5. 验证

- [x] 5.1 `npm run build` 通过，无 TypeScript 错误
