## 1. Git Untracking

- [x] 1.1 `.gitignore`：移除第 20 行 `!groups/main/HEARTBEAT.md`，使该文件被 `groups/main/*` 规则排除，不再被 git 追踪
- [x] 1.2 验证：`git check-ignore -v groups/main/HEARTBEAT.md` 应输出匹配规则；`git status` 中不再出现 HEARTBEAT.md

## 2. Auto-init on Registration

- [x] 2.1 `setup/register.ts`：在 heartbeat-main 任务创建块之后，检查 `groups/{folder}/HEARTBEAT.md` 是否存在，不存在则写入模版内容
- [x] 2.2 模版内容（内嵌常量 `HEARTBEAT_TEMPLATE`）：
  ```
  # HEARTBEAT.md

  # Keep this file empty (or with only comments) to skip heartbeat API calls.

  # Add tasks below when you want the agent to check something periodically.
  ```
- [x] 2.3 写入操作为幂等：仅在文件不存在时写入（`ENOENT` 时创建，已存在则不覆盖）
- [x] 2.4 `setup/register.ts` 加日志：`logger.info('Created default HEARTBEAT.md for main group')`

## 3. Tests

- [x] 3.1 `setup/register.test.ts`：注册 main group 后，若 HEARTBEAT.md 不存在，应自动创建并包含模版内容
- [x] 3.2 `setup/register.test.ts`：HEARTBEAT.md 已存在时，注册不覆盖（幂等验证）

## 4. Validation

- [x] 4.1 运行 `openspec validate init-heartbeat-md --strict`，无错误
- [x] 4.2 运行 `npm test`，无测试失败（process-runner.test.ts 的失败为预存在问题，与本次变更无关）
