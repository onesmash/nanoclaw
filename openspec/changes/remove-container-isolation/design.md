# Design: Remove Container Isolation Layer

## Context

NanoClaw 当前架构中，agent 通过 `src/container-runner.ts` spawn Docker 容器来执行。容器提供文件系统隔离，路径通过 volume mounts 挂载（`-v groupDir:/workspace/group` 等）。`src/container-runtime.ts` 负责管理 Docker daemon 状态检查、孤儿容器清理等生命周期操作。

这一设计的初衷是安全隔离，但对于个人使用场景，Claude Code SDK 自带的权限边界（allowedTools、allowed paths）已足够，OS 级别的容器隔离是过度设计，且引入 Docker 作为强制依赖。

## Goals / Non-Goals

- Goals:
  - 移除 Docker/Apple Container 作为运行时依赖
  - 保持 stdin/stdout IPC 协议完全不变（`ContainerInput`/`ContainerOutput`、`OUTPUT_START...OUTPUT_END` markers）
  - 保持 agent-runner 代码在容器中仍可工作（env var 回退）
  - 简化构建流程，直接编译 agent-runner 为本地可执行 JS
- Non-Goals:
  - 重构 IPC 协议
  - 变更 agent-runner 的 AI 行为或工具权限
  - 引入新的隔离机制（沙箱、chroot 等）
  - 更改消息路由或渠道系统

## Decisions

### Decision: 用环境变量替代 volume mounts

Volume mounts 将宿主路径映射为容器内固定路径（`/workspace/group` 等）。改为进程后，直接传入宿主绝对路径更自然。

选用 `NANOCLAW_*` 前缀的环境变量，以 `/workspace/` 为默认回退值，确保同一份 agent-runner 代码在容器和进程两种模式下均可运行。

变量映射：

| 环境变量 | 宿主路径 | 原容器路径 |
|---------|---------|----------|
| `NANOCLAW_GROUP_DIR` | `resolveGroupFolderPath(group.folder)` | `/workspace/group` |
| `NANOCLAW_IPC_DIR` | `resolveGroupIpcPath(group.folder)` | `/workspace/ipc` |
| `NANOCLAW_GLOBAL_DIR` | `path.join(GROUPS_DIR, 'global')` | `/workspace/global` |
| `NANOCLAW_EXTRA_DIR` | 第一个 `additionalMounts` 条目（如有） | `/workspace/extra` |
| `HOME` | `path.join(DATA_DIR, 'sessions', group.folder)` | `/home/node` |
| `TZ` | `TIMEZONE` | `-e TZ=...` |

Secrets（`ANTHROPIC_API_KEY` 等）继续通过 `ContainerInput.secrets` 经 stdin 传入，不放入环境变量。

### Decision: 移除每群组 agent-runner 定制机制

当前 `container-runner.ts` 会将 `container/agent-runner/src/` 复制到每个群组的 `data/sessions/{group}/agent-runner-src/` 并在容器启动时重新编译，支持每群组定制化。此机制在移除容器后无法直接延续，且无任何现有群组使用此功能，因此一并移除。

所有群组共用单一编译产物 `container/agent-runner/dist/`。如需定制，手动执行 `npm run build:agent-runner`。

### Decision: 新建 process-runner.ts，保留 container-runner.ts 文件名仅在过渡期

创建 `src/process-runner.ts` 作为新的 spawn 实现，导出与原 `container-runner.ts` 相同的符号（`runContainerAgent` 或重命名为 `runProcessAgent`、`ContainerInput`、`ContainerOutput` 等），使调用方改动最小化。`container-runner.ts` 随后删除。

## Risks / Trade-offs

- **安全降级**：移除 OS 级容器隔离后，agent 直接运行在宿主进程空间，Claude Code SDK 的 `allowedTools` 是唯一硬边界。对个人使用可接受，不适合多租户场景。→ 在文档中明确说明此限制。
- **路径泄漏**：宿主绝对路径通过环境变量暴露给 agent-runner 进程。→ 与原 volume mount 模式风险相当，secrets 仍走 stdin，不受影响。
- **构建顺序依赖**：`npm run build` 需先编译 agent-runner 再编译主项目（agent-runner dist 需在主构建时存在）。→ 在 `package.json` scripts 中通过串联脚本强制顺序。

## Migration Plan

1. 合并此 PR 后，`npm run build` 自动完成全量编译
2. 服务重启后不再需要 Docker
3. 回滚：还原 `src/container-runtime.ts`，在 `process-runner.ts` 中切回 Docker spawn，重建容器镜像

## Open Questions

- 无（设计文档 `docs/plans/2026-03-07-remove-container-isolation-design.md` 标注状态 Approved，无待决问题）
