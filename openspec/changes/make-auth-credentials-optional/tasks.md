# Implementation Tasks

## 1. 核心认证检查模块
- [x] 1.1 创建 `src/auth-check.ts`,实现 `checkClaudeAuth()` 函数检查 claude CLI 登录状态
- [x] 1.2 实现 `checkAuthentication()` 函数,按优先级检查可用的认证方式
- [x] 1.3 添加 TypeScript 类型定义 (`ClaudeAuthStatus`, `AuthenticationResult`)
- [x] 1.4 为 `auth-check.ts` 编写单元测试

## 2. 修改启动逻辑
- [x] 2.1 在 `src/index.ts` 的 `main()` 函数开始处调用 `checkAuthentication()`
- [x] 2.2 根据认证方式输出相应的日志信息(使用英文)
- [x] 2.3 如果无可用认证方式,输出清晰的错误提示(使用英文)并退出(exit code 1)
- [x] 2.4 测试启动流程的各种认证场景

## 3. 修改凭证读取逻辑
- [x] 3.1 修改 `src/process-runner.ts` 的 `readSecrets()` 函数,使所有凭证变为可选
- [x] 3.2 只返回实际存在且非空的凭证
- [x] 3.3 更新 `readSecrets()` 的代码注释(使用英文),说明凭证现在是可选的
- [x] 3.4 验证容器内 Agent SDK 能正确使用 claude CLI 会话

## 4. 文档更新
- [x] 4.1 更新 `.claude/skills/setup/SKILL.md`,修改认证配置步骤说明
- [x] 4.2 更新 `README.md`,添加 "Authentication" 章节说明三种认证方式
- [x] 4.3 在 README 的 Quick Start 部分添加 claude CLI 认证说明
- [x] 4.4 添加 FAQ 条目:"Do I need an API key?" 和 "Which authentication method should I use?"

## 5. 测试与验证
- [x] 5.1 测试场景 1: 使用 `ANTHROPIC_API_KEY`,验证正常工作
- [x] 5.2 测试场景 2: 使用 `ANTHROPIC_AUTH_TOKEN`,验证正常工作
- [x] 5.3 测试场景 3: 不设置凭证但已登录 claude CLI,验证正常工作
- [x] 5.4 测试场景 4: 无任何认证,验证启动失败并显示正确提示
- [x] 5.5 测试场景 5: 同时设置 API key 和登录 claude CLI,验证优先使用 API key
- [x] 5.6 运行完整测试套件 `npm test`,确保无回归

## 6. 类型检查与格式化
- [x] 6.1 运行 `npm run typecheck`,确保无类型错误
- [x] 6.2 运行 `npm run format`,格式化所有修改的文件
- [x] 6.3 确认所有 ESM import 路径使用 `.js` 扩展名
