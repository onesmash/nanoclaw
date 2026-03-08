# Tasks: fix-ipc-internal-tag-leak

## Implementation Tasks

- [x] 1. 在 `src/ipc.ts` 中导入 `formatOutbound` 函数
- [x] 2. 在 IPC 消息发送前调用 `formatOutbound(data.text)` 过滤 `<internal>` 标签
- [x] 3. 添加空消息检查：如果过滤后为空字符串，跳过发送并记录 debug 日志
- [x] 4. 运行现有测试套件验证无破坏性变更：`npm test`
- [x] 5. 手动测试：发送包含 `<internal>` 标签的 IPC 消息，验证标签被过滤
- [x] 6. 手动测试：发送纯 `<internal>` 内容，验证消息不发送且有 debug 日志

## Validation

- [x] 所有现有测试通过
- [x] IPC 消息中的 `<internal>` 标签被正确移除
- [x] 纯 `<internal>` 消息不会发送
- [x] 普通消息（无 `<internal>` 标签）行为不变
- [x] 日志中有 "IPC message was empty after stripping internal tags" 的 debug 记录（当适用时）

## Notes

- 所有任务已完成
- 相关测试全部通过（`src/formatting.test.ts`, `src/ipc-auth.test.ts`）
- 手动测试验证：IPC 消息正确过滤 `<internal>` 标签
- 修改已通过编译（`npm run build` 成功）
- 服务已重启并运行正常
- Debug 日志需要 `LOG_LEVEL=debug` 才可见（默认 INFO 级别）
