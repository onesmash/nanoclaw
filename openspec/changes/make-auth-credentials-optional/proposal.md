# Change: 使认证凭证可选,支持 Claude CLI 会话认证

## Why

当前 NanoClaw 强制要求在 `.env` 中配置 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`,但 Claude Agent SDK 实际上支持无凭证模式:当用户通过 `claude` CLI 登录后,SDK 可以自动使用已认证的会话。这导致:

1. 用户已通过 SSO 登录 claude.ai,却仍需单独配置 API token,体验不佳
2. 个人使用场景下需要管理额外的 API key,增加复杂度
3. 代码强制读取环境变量,但 SDK 本身并不需要它们

## What Changes

- 新增 `src/auth-check.ts` 模块,检查 claude CLI 认证状态
- 修改 `src/index.ts` 启动逻辑,在启动时检查可用的认证方式
- 修改 `src/process-runner.ts` 的 `readSecrets()`,将凭证从必需改为可选
- 更新 `/setup` skill 文档,说明 API key 现在是可选的
- 更新 README.md,添加认证方式说明

**认证优先级**:
1. `ANTHROPIC_API_KEY` (如果设置) → 使用 API key
2. `ANTHROPIC_AUTH_TOKEN` (如果设置) → 使用 auth token
3. 否则 → 依赖 claude CLI 会话(自动)
4. 如果以上都不可用 → 启动失败并提示

**向后兼容**: 现有使用 API key 的用户完全不受影响

## Impact

- **Affected specs**: `agent-authentication` (新增)
- **Affected code**:
  - `src/auth-check.ts` (新增)
  - `src/index.ts` (修改启动检查)
  - `src/process-runner.ts` (修改 `readSecrets()`)
  - `.claude/skills/setup/SKILL.md` (文档更新)
  - `README.md` (文档更新)
- **Breaking changes**: 无
- **Migration**: 无需迁移,现有配置继续有效
