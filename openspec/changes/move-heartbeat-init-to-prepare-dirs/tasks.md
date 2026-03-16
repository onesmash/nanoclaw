# Tasks: Move HEARTBEAT.md Init to prepareGroupDirs()

- [x] 1.1 在 `src/process-runner.ts` 的 `TOOLS_MD_TEMPLATE` 附近添加 `HEARTBEAT_MD_TEMPLATE` 常量（与 `setup/register.ts` 中现有模板内容一致）
- [x] 1.2 在 `prepareGroupDirs()` 的 main group 块中，添加 HEARTBEAT.md 的 `writeFileIfMissing` 逻辑（紧接 TOOLS.md 块之后）
- [x] 2.1 从 `setup/register.ts` 中删除 HEARTBEAT.md 自动创建块（`// Auto-create HEARTBEAT.md` 注释至 `logger.info('Created default HEARTBEAT.md...')` 共约 10 行）
- [x] 3.1 从 `setup/register.test.ts` 中删除 `describe('HEARTBEAT.md auto-init', ...)` 测试块
- [x] 4.1 运行 `npm test` 确认所有测试通过（1 个预存失败与本次改动无关）
