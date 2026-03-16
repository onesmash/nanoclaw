# Change: Move HEARTBEAT.md Init to prepareGroupDirs()

## Why

`HEARTBEAT.md` 目前在 `setup/register.ts` 的注册流程中创建，但这与其他运行时文件（`TOOLS.md`、`USER.md`、`BOOTSTRAP.md`）的创建时机不一致——这些文件都在 `src/process-runner.ts` 的 `prepareGroupDirs()` 中按需初始化（首次 agent 启动前）。

注册是一次性操作，而 `prepareGroupDirs()` 是运行时保障：即使文件丢失（手动删除、新 clone），下次启动时会自动补全。把 HEARTBEAT.md 的创建放在注册里违反了这一保障。

## What Changes

1. **`src/process-runner.ts`**：在 `prepareGroupDirs()` 的 main group 块中，添加 HEARTBEAT.md 的 `writeFileIfMissing` 逻辑，与 TOOLS.md 并列
2. **`setup/register.ts`**：删除 HEARTBEAT.md 自动创建块（约 10 行）
3. **`setup/register.test.ts`**：删除 `HEARTBEAT.md auto-init` describe 块（约 40 行）

## Impact

- Affected specs: `heartbeat`（MODIFIED）
- Affected code:
  - `src/process-runner.ts` — `prepareGroupDirs()` 添加 HEARTBEAT.md 写入
  - `setup/register.ts` — 删除 HEARTBEAT.md 创建逻辑
  - `setup/register.test.ts` — 删除对应测试
- No schema changes, no new dependencies
