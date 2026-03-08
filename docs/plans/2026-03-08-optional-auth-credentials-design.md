# 可选认证凭证设计

**日期**: 2026-03-08  
**状态**: 设计阶段

## 问题分析

### 当前问题

NanoClaw 当前强制要求在 `.env` 文件中配置 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`,但实际上:

1. **Claude Agent SDK 支持无凭证模式**: 当用户通过 `claude` CLI 登录后,SDK 可以自动使用已认证的会话
2. **用户体验不佳**: 用户已经通过 SSO 登录了 claude.ai,却还需要单独配置 API token
3. **不必要的凭证管理**: 对于个人使用场景,管理额外的 API key 增加了复杂度
4. **技术限制误解**: 代码中强制读取这些环境变量,但 SDK 本身并不需要它们

### 技术背景

根据 Claude Agent SDK 文档和实践:

- 当 `ANTHROPIC_API_KEY` 环境变量存在时,SDK 使用该 API key
- 当环境变量不存在时,SDK 会自动查找 `claude` CLI 的已登录会话
- `claude` CLI 通过 `claude login` 命令支持 SSO 登录(claude.ai 账号)
- 已登录状态可通过 `claude auth status` 检查

参考: [robzolkos/agent-sdk-no-key](https://github.com/robzolkos/agent-sdk-no-key)

## 设计目标

1. **灵活的认证方式**: 支持 API key、Auth token 和 claude CLI 会话三种认证方式
2. **智能回退**: 优先使用显式配置的凭证,如果没有则自动使用 claude CLI 会话
3. **清晰的错误提示**: 如果所有认证方式都不可用,给出明确的操作指引
4. **向后兼容**: 现有使用 API key 的用户不受影响
5. **简化个人使用**: 个人用户可以直接使用 claude CLI 会话,无需管理 API key

## 技术方案

### 认证优先级策略

```
1. ANTHROPIC_API_KEY (如果在 .env 中设置)
   ↓ 如果未设置
2. ANTHROPIC_AUTH_TOKEN (如果在 .env 中设置)  
   ↓ 如果未设置
3. Claude CLI 会话 (自动检测 claude auth status)
   ↓ 如果未登录
4. 启动失败,提示用户配置认证
```

### 代码修改点

#### 1. 新增认证检查模块 (`src/auth-check.ts`)

```typescript
export interface ClaudeAuthStatus {
  loggedIn: boolean;
  email?: string;
  orgName?: string;
  subscriptionType?: string | null;
}

/**
 * 检查 claude CLI 是否已安装并登录
 */
export async function checkClaudeAuth(): Promise<ClaudeAuthStatus> {
  try {
    const result = await execAsync('claude auth status');
    const status = JSON.parse(result.stdout);
    return {
      loggedIn: status.loggedIn === true,
      email: status.email,
      orgName: status.orgName,
      subscriptionType: status.subscriptionType,
    };
  } catch (error) {
    return { loggedIn: false };
  }
}

/**
 * 检查是否有可用的认证方式
 * 返回认证方式类型和相关信息
 */
export async function checkAuthentication(): Promise<{
  method: 'api_key' | 'auth_token' | 'claude_cli' | 'none';
  info?: string;
}> {
  const env = readEnvFile(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']);
  
  if (env.ANTHROPIC_API_KEY) {
    return { method: 'api_key', info: 'ANTHROPIC_API_KEY' };
  }
  
  if (env.ANTHROPIC_AUTH_TOKEN) {
    return { method: 'auth_token', info: 'ANTHROPIC_AUTH_TOKEN' };
  }
  
  const claudeAuth = await checkClaudeAuth();
  if (claudeAuth.loggedIn) {
    return { 
      method: 'claude_cli', 
      info: `${claudeAuth.email}${claudeAuth.orgName ? ` (${claudeAuth.orgName})` : ''}` 
    };
  }
  
  return { method: 'none' };
}
```

#### 2. 修改启动逻辑 (`src/index.ts`)

在主函数开始时添加认证检查:

```typescript
import { checkAuthentication } from './auth-check.js';

async function main() {
  console.log('Starting NanoClaw...');
  
  // 检查认证
  const auth = await checkAuthentication();
  
  switch (auth.method) {
    case 'api_key':
      console.log('✓ 使用 ANTHROPIC_API_KEY 认证');
      break;
    case 'auth_token':
      console.log('✓ 使用 ANTHROPIC_AUTH_TOKEN 认证');
      break;
    case 'claude_cli':
      console.log(`✓ 使用 claude CLI 会话认证 (${auth.info})`);
      break;
    case 'none':
      console.error('✗ 未找到认证凭证');
      console.error('✗ claude CLI 未登录\n');
      console.error('请选择一种认证方式:');
      console.error('1. 运行: claude login');
      console.error('2. 或在 .env 中配置: ANTHROPIC_API_KEY=sk-ant-xxx');
      process.exit(1);
  }
  
  // 继续原有启动逻辑...
}
```

#### 3. 修改凭证读取 (`src/process-runner.ts`)

将强制读取改为可选读取:

```typescript
/**
 * Read allowed secrets from .env for passing to the process via stdin.
 * Secrets are never written to disk or exposed as environment variables.
 * All secrets are now OPTIONAL - if not provided, Agent SDK will use claude CLI session.
 */
function readSecrets(): Record<string, string> {
  const secrets = readEnvFile([
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AUTH_TOKEN',
  ]);
  
  // 只返回实际存在的凭证
  return Object.fromEntries(
    Object.entries(secrets).filter(([_, value]) => value !== undefined && value !== '')
  );
}
```

#### 4. 容器内无需修改

Agent SDK 会自动处理:
- 如果环境变量 `ANTHROPIC_API_KEY` 存在 → 使用 API key
- 如果环境变量不存在 → 使用 claude CLI 会话

**重要**: 容器需要能够访问宿主机的 claude CLI 会话。这在当前架构下已经满足,因为:
- Docker 容器继承宿主机的用户环境
- Apple Container 同样继承用户环境
- claude CLI 的认证信息存储在用户目录下,容器可以访问

### 边界情况处理

#### 情况 1: claude CLI 未安装

```
✗ 未找到认证凭证
✗ claude CLI 未安装

请选择一种认证方式:
1. 安装 claude CLI: npm install -g @anthropic-ai/claude-code
   然后运行: claude login
2. 或在 .env 中配置: ANTHROPIC_API_KEY=sk-ant-xxx
```

#### 情况 2: claude CLI 已安装但未登录

```
✗ 未找到认证凭证
✗ claude CLI 未登录

请运行: claude login
或在 .env 中配置: ANTHROPIC_API_KEY=sk-ant-xxx
```

#### 情况 3: 运行时 claude CLI 会话过期

如果启动时检查通过,但运行时会话过期:
- Agent SDK 会抛出认证错误
- 错误会通过正常的错误处理流程返回给用户
- 用户需要重新运行 `claude login` 并重启 NanoClaw

### 测试场景

1. **使用 API key**: 设置 `ANTHROPIC_API_KEY`,验证正常工作
2. **使用 auth token**: 设置 `ANTHROPIC_AUTH_TOKEN`,验证正常工作
3. **使用 claude CLI**: 不设置任何凭证,已登录 claude CLI,验证正常工作
4. **无认证**: 不设置凭证且未登录 claude CLI,验证启动失败并显示正确提示
5. **优先级**: 同时设置 API key 和登录 claude CLI,验证使用 API key

## 用户体验变化

### 使用场景对比

#### 场景 1: 使用 API Key (现有用户)

```bash
# .env 文件
ANTHROPIC_API_KEY=sk-ant-xxx

# 启动日志
✓ 使用 ANTHROPIC_API_KEY 认证
```

**影响**: 无变化,完全兼容

#### 场景 2: 使用 Claude CLI 会话 (新支持)

```bash
# .env 文件为空或不包含 ANTHROPIC_API_KEY

# 启动日志
✓ 使用 claude CLI 会话认证 (hui.xu@zoom.us)
```

**影响**: 新功能,无需配置 token

#### 场景 3: 未认证 (错误提示)

```bash
# 启动日志
✗ 未找到认证凭证
✗ claude CLI 未登录

请选择一种认证方式:
1. 运行: claude login
2. 或在 .env 中配置: ANTHROPIC_API_KEY=sk-ant-xxx
```

**影响**: 更清晰的错误提示

### 文档更新需求

#### 1. README.md

在 "Quick Start" 部分添加说明:

```markdown
## Authentication

NanoClaw supports three authentication methods (in priority order):

1. **API Key** (recommended for production): Set `ANTHROPIC_API_KEY` in `.env`
2. **Auth Token**: Set `ANTHROPIC_AUTH_TOKEN` in `.env`  
3. **Claude CLI Session** (recommended for personal use): Run `claude login`

For personal use, the easiest way is to use your existing Claude subscription:

```bash
claude login  # Login with your claude.ai account
```

Then NanoClaw will automatically use your authenticated session.
```

#### 2. `/setup` skill (`.claude/skills/setup/SKILL.md`)

修改认证配置步骤:

**当前**:
```markdown
## Step 2: Configure Authentication

Ask user for their Anthropic API key and save to .env
```

**修改为**:
```markdown
## Step 2: Configure Authentication (Optional)

Check if claude CLI is already logged in:
- Run `claude auth status`
- If logged in, inform user they can skip API key configuration
- If not logged in, offer two options:
  1. Run `claude login` (recommended for personal use)
  2. Configure ANTHROPIC_API_KEY in .env (for production/team use)
```

#### 3. 新增 FAQ 条目

```markdown
### Q: Do I need an API key?

No! If you have a Claude Pro or Max subscription, you can use your existing account:

1. Run `claude login` in your terminal
2. Start NanoClaw - it will automatically use your authenticated session

API keys are optional and recommended for production deployments or team use.

### Q: Which authentication method should I use?

- **Personal use**: Use `claude login` (easiest, uses your existing subscription)
- **Production/Team**: Use `ANTHROPIC_API_KEY` (more control, separate billing)
- **Testing**: Either method works
```

## 实施计划

### 阶段 1: 核心功能 (必需)

1. 创建 `src/auth-check.ts` 模块
2. 修改 `src/index.ts` 添加启动检查
3. 修改 `src/process-runner.ts` 使凭证可选
4. 测试三种认证方式

### 阶段 2: 文档更新 (必需)

1. 更新 README.md
2. 更新 `/setup` skill
3. 添加 FAQ 条目

### 阶段 3: 优化 (可选)

1. 添加 `nanoclaw auth status` 命令显示当前认证方式
2. 在 `/debug` skill 中添加认证诊断
3. 考虑添加认证方式切换的便捷命令

## 风险与限制

### 风险

1. **容器访问 claude CLI 会话**: 需要确认容器能够访问宿主机的 claude 认证信息
   - **缓解**: 在测试阶段验证 Docker 和 Apple Container 都能正常访问
   
2. **会话过期处理**: claude CLI 会话可能在运行时过期
   - **缓解**: 依赖 Agent SDK 的错误处理,用户会收到明确的错误信息

3. **向后兼容性**: 现有用户可能依赖当前的错误行为
   - **缓解**: 保持 API key 方式完全不变,只是放宽限制

### 限制

1. **企业 SSO**: 此方案不支持企业级 SSO(如 Azure AD, Okta)
   - 企业用户应继续使用 API key 方式
   
2. **Rate Limits**: claude CLI 会话使用个人账号的 rate limits
   - 生产环境建议使用独立的 API key

3. **审计追踪**: 使用 claude CLI 会话时,API 调用会记录在个人账号下
   - 团队使用建议配置独立的 API key

## 替代方案

### 方案 A: 完全移除凭证要求

**描述**: 完全不检查凭证,直接依赖 Agent SDK 的错误处理

**优点**:
- 代码最简单
- 零配置启动

**缺点**:
- 错误信息不友好(来自 SDK 内部)
- 用户可能不知道如何解决认证问题

**决策**: 不采用,用户体验较差

### 方案 B: 保持现状但改进文档

**描述**: 继续要求凭证,但在文档中说明可以设置假值

**优点**:
- 代码改动最小
- 向后兼容性最好

**缺点**:
- 用户体验差,需要设置无意义的值
- 不直观,违反最小惊讶原则

**决策**: 不采用,不符合设计目标

### 方案 C: 环境变量自动检测(当前方案)

**描述**: 智能检测可用的认证方式,优雅回退

**优点**:
- 灵活性最好
- 向后兼容
- 用户体验最佳

**缺点**:
- 需要添加认证检查逻辑
- 略微增加启动时间(~100ms)

**决策**: 采用,最符合设计目标

## 总结

此设计方案通过智能的认证检测和优雅的回退机制,在保持向后兼容的同时,显著改善了个人用户的使用体验。用户可以直接使用已登录的 claude CLI 会话,无需管理额外的 API key,同时保留了生产环境使用独立凭证的灵活性。

实施后,NanoClaw 将支持三种认证方式,自动选择最合适的方式,并在无法认证时提供清晰的操作指引。
