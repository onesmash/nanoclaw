## 1. 更新 customize 技能文档

- [x] 1.1 修改 `.claude/skills/customize/SKILL.md` 中"Changing Persona / Response Style"章节：将"修改风格/性格/语气"类请求指向 `groups/main/IDENTITY.md` 的 `Vibe` 字段，保留 `CLAUDE.md` 仅用于行为规则
- [x] 1.2 在技能的 Key Files 表格中，补充对 `Vibe` 字段用途的说明，区分 `IDENTITY.md`（角色定义）与 `CLAUDE.md`（行为规则）
- [x] 1.3 在"Changing Identity"小节下，将 Emoji/Creature/Vibe/Avatar 的修改步骤与"风格修改"统一，确保操作路径一致（均通过 `IDENTITY.md`）

## 2. 验证

- [x] 2.1 检查技能文档中不再混淆 `CLAUDE.md` 与 `IDENTITY.md` 的用途
- [x] 2.2 确认风格修改流程（编辑 `IDENTITY.md` → 清除会话 → 重启服务）描述完整且正确
