# Change: Route style/personality changes through IDENTITY.md in customize skill

## Why

当用户通过 `/customize` 技能请求修改 AI 助手的"风格"、"性格"或"语气"时，当前指引将其导向 `groups/global/CLAUDE.md` 或 `groups/{folder}/CLAUDE.md`。然而 `IDENTITY.md`（位于 `groups/main/IDENTITY.md`）已包含专用的 `Vibe` 字段用于描述助手的性格特质，而 `CLAUDE.md` 应专注于行为规则与功能说明。两个文件的职责划分不清导致用户在修改风格时被引导到错误位置。

## What Changes

- 在 `/customize` 技能中，将"修改风格/性格/语气"类请求的操作目标从 `CLAUDE.md` 改为 `groups/main/IDENTITY.md` 的 `Vibe` 字段
- 明确区分两类定制：
  - **角色/风格（Character/Style）** → `groups/main/IDENTITY.md`（`Vibe`、`Creature`、`Emoji` 等字段）
  - **行为规则/功能说明（Behavioral Rules）** → `groups/global/CLAUDE.md` 或 `groups/{folder}/CLAUDE.md`
- 更新技能中"Changing Persona / Response Style"章节，优先引导用户修改 `IDENTITY.md`，并补充说明何时应改用 `CLAUDE.md`

## Impact

- Affected specs: `customize-skill`, `identity-lifecycle`
- Affected code: `.claude/skills/customize/SKILL.md`
