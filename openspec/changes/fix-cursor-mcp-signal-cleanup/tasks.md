## 1. Implementation

- [x] 1.1 在 `cursor-runner.ts` 的 `cleanupConfigs()` 定义后，注册 `process.on('exit', cleanupConfigs)`
- [x] 1.2 注册 `process.on('SIGTERM', () => { cleanupConfigs(); process.exit(0); })`
- [x] 1.3 注册 `process.on('SIGINT', () => { cleanupConfigs(); process.exit(0); })`

## 2. Validation

- [x] 2.1 运行 `npm run build`（`container/agent-runner`）确认 TypeScript 编译无错误
