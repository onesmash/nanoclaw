# Capability: ipc-message-formatting

IPC 消息格式化——在 agent 通过 IPC 发送消息到用户前，应用与主消息流程一致的格式化规则，包括 `<internal>` 标签过滤。

## ADDED Requirements

### Requirement: IPC Message Internal Tag Filtering

IPC watcher 在处理 `type: 'message'` 的 IPC 文件时，SHALL 在调用 `deps.sendMessage()` 前应用 `formatOutbound()` 过滤 `<internal>` 标签，确保 agent 的内部思考过程不泄漏到用户消息中。

过滤规则：
- 移除所有 `<internal>...</internal>` 块（包括多行和嵌套）
- Trim 前后空白
- 如果过滤后为空字符串，跳过发送

#### Scenario: 过滤前缀 internal 标签

- **WHEN** IPC 消息内容为 `<internal>思考中...</internal>你好`
- **THEN** 发送给用户的消息为 `你好`

#### Scenario: 过滤中间 internal 标签

- **WHEN** IPC 消息内容为 `你好<internal>内部推理</internal>世界`
- **THEN** 发送给用户的消息为 `你好世界`

#### Scenario: 纯 internal 内容不发送

- **WHEN** IPC 消息内容为 `<internal>只有内部内容</internal>`
- **THEN** 消息不发送给用户
- **AND** 记录 debug 级别日志："IPC message was empty after stripping internal tags, skipped"

#### Scenario: 无 internal 标签的消息不受影响

- **WHEN** IPC 消息内容为 `正常消息`
- **THEN** 发送给用户的消息为 `正常消息`（行为不变）

### Requirement: IPC Message Filtering Consistency

IPC 消息的 `<internal>` 标签过滤 SHALL 使用与主消息流程（`src/index.ts`）相同的 `formatOutbound()` 函数，确保两条路径的过滤行为完全一致。

#### Scenario: 使用相同的过滤函数

- **WHEN** IPC watcher 需要过滤消息
- **THEN** 调用 `formatOutbound()` 函数（来自 `src/router.ts`）
- **AND** 不实现独立的过滤逻辑

#### Scenario: 过滤行为与主流程一致

- **WHEN** 同一消息内容分别通过主流程和 IPC 流程发送
- **THEN** 两条路径过滤后的结果完全相同

## MODIFIED Requirements

无。IPC 消息的授权、文件处理、错误处理等逻辑保持不变。

## REMOVED Requirements

无。
