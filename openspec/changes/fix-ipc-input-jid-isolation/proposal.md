# Change: Fix IPC Input JID Isolation for Shared-Folder Channels

## Why

当两个渠道（如 Zoom DM 和飞书私聊）被注册到同一个 `folder`（如 `main`）时，两个 agent container 会共享相同的 `NANOCLAW_IPC_DIR = data/ipc/main/`，导致 IPC input pipe 目录相同：`data/ipc/main/input/`。

`GroupQueue.sendMessage()` 将 follow-up 消息写入 `ipc/main/input/`，但两个 container 都在轮询该目录。**哪个 container 先读取文件，哪个就消费该消息**——如果 Feishu container 抢先读取了一条本该给 Zoom container 的消息，Feishu container 会用它自己的 `chatJid = fs:p_xxx` 处理并回复，消息就被路由到了飞书渠道。

**根因证据（数据库查询）**：
```
zoom:dm:cZpZVNQEQgC6BG2_UlxY-g  → folder=main, isMain=1
fs:p_ou_4ccaff919b4d94d3aa89af59da52de69  → folder=main, isMain=1
```

两个 JID 共用 `main` folder，IPC input 目录相同，形成竞争条件。

## What Changes

在 IPC input 消息中加入 `chatJid` 字段，container 只消费与自身 `chatJid` 匹配的消息，跳过不属于自己的消息（留给正确的 container 消费）。

**改动范围（4 个文件）**：
- `src/group-queue.ts`：`sendMessage()` 写入文件时加入 `chatJid` 字段
- `container/agent-runner/src/shared.ts`：`drainIpcInput()` 增加可选 `chatJid` 过滤参数；不匹配的文件跳过但不删除
- `container/agent-runner/src/claude-runner.ts`：向 `drainIpcInput()` 和 `waitForIpcMessage()` 传入 `containerInput.chatJid`
- `container/agent-runner/src/cursor-runner.ts`：同上

**向后兼容性**：无 `chatJid` 字段的旧消息文件（单渠道场景）仍被任意 container 消费，行为不变。

## Impact

- Affected specs: `ipc-message-routing`（ADDED：新 capability）
- Affected code:
  - `src/group-queue.ts` — 1 处改动（`sendMessage` 写入加字段）
  - `container/agent-runner/src/shared.ts` — `drainIpcInput` 签名变更
  - `container/agent-runner/src/claude-runner.ts` — 传参变更
  - `container/agent-runner/src/cursor-runner.ts` — 传参变更
- Risk: LOW（无破坏性变更，向后兼容）
- Depends on: 无
