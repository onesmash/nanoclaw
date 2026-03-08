# Proposal: fix-ipc-internal-tag-leak

## Problem

Agent 通过 IPC `send_message` 工具发送的消息会直接传递给用户，未经过 `<internal>` 标签过滤。这导致 agent 的内部思考过程（用 `<internal>...</internal>` 包裹的内容）泄漏到用户消息中，暴露了不应对外的推理细节。

**当前行为**：
- `src/index.ts` 中的主消息流程调用 `formatOutbound()` 过滤 `<internal>` 标签
- `src/ipc.ts` 中的 IPC 消息流程直接调用 `deps.sendMessage()`，跳过了过滤步骤

**用户影响**：
- 用户收到包含 `<internal>思考中...</internal>` 的消息
- 内部推理过程暴露，降低用户体验
- 纯 `<internal>` 内容也会发送，产生空消息或无意义输出

## Solution

在 IPC 消息发送前应用 `formatOutbound()` 过滤，与主消息流程保持一致。

**变更范围**：
- `src/ipc.ts` - 在发送前调用 `formatOutbound(data.text)`
- 如果过滤后为空字符串，跳过发送并记录 debug 日志

**不变更**：
- `formatOutbound()` 和 `stripInternalTags()` 的实现保持不变
- IPC 文件格式、授权逻辑、其他 IPC 操作类型均不受影响

## Scope

**In Scope**：
- IPC 消息类型（`type: 'message'`）的 `<internal>` 标签过滤
- 空消息跳过逻辑

**Out of Scope**：
- 其他 IPC 操作类型（task、refresh_groups 等）
- `formatOutbound()` 函数本身的增强
- 主消息流程（已正确过滤）

## Alternatives Considered

1. **在 agent-runner 端过滤**
   - ❌ 需要修改 MCP 工具实现，影响范围更大
   - ❌ 与主消息流程的过滤位置不一致

2. **在 `formatOutbound()` 中添加日志**
   - ❌ 过度耦合，该函数应保持纯函数特性
   - ✅ 在调用方记录更合适

3. **当前方案：在 IPC watcher 中过滤**
   - ✅ 最小变更范围
   - ✅ 与主消息流程对称
   - ✅ 保持 `formatOutbound()` 的纯函数特性

## Risks

- **低风险**：修改仅影响消息内容过滤，不改变发送逻辑
- **向后兼容**：不含 `<internal>` 标签的消息行为不变
- **测试覆盖**：现有 `formatOutbound()` 测试已覆盖过滤逻辑

## Dependencies

无外部依赖。依赖现有的 `formatOutbound()` 函数（`src/router.ts`）。

## Success Criteria

- IPC 消息中的 `<internal>` 标签被正确过滤
- 纯 `<internal>` 内容不会发送空消息
- 现有测试全部通过
- 不影响其他 IPC 操作类型
