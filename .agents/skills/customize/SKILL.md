---
name: customize
description: Add new capabilities or modify NanoClaw behavior. Use when user wants to add channels (Telegram, Slack, email input), change triggers, add integrations, modify the router, or make any other customizations. This is an interactive skill that asks questions to understand what the user wants.
---

# NanoClaw Customization

This skill helps users add capabilities or modify behavior. Use AskUserQuestion to understand what they want before making changes.

## Workflow

1. **Understand the request** - Ask clarifying questions
2. **Plan the changes** - Identify files to modify
3. **Implement** - Make changes directly to the code
4. **Test guidance** - Tell user how to verify

## Key Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Orchestrator: state, message loop, agent invocation |
| `src/channels/registry.ts` | Channel self-registration (`registerChannel`) |
| `src/ipc.ts` | IPC watcher and task processing |
| `src/router.ts` | Message formatting and outbound routing |
| `src/types.ts` | TypeScript interfaces (includes `Channel`) |
| `.env` | API keys, channel credentials |
| `groups/main/IDENTITY.md` | Who the assistant IS: name, creature, vibe (style/personality), emoji, avatar |
| `src/db.ts` | Database initialization and queries |
| `groups/global/CLAUDE.md` | What the assistant DOES: behavioral rules and instructions (applies to all groups) |
| `groups/{folder}/CLAUDE.md` | Per-group behavioral rules and instructions |

## Common Customization Patterns

### Adding a New Input Channel (e.g., Feishu, Telegram, Slack, Discord)

Questions to ask:
- Which channel? (Feishu, Telegram, Slack, Discord, email, etc.)
- Same trigger word or different?
- Same memory hierarchy or separate?
- Should messages from this channel go to existing groups or new ones?

Implementation pattern (preferred — use the skills engine):
1. Check if a pre-built skill exists: `.claude/skills/add-{channel}/`
2. If yes, apply it: `npx tsx scripts/apply-skill.ts .claude/skills/add-{channel}`
3. This automatically adds the channel file, registers it, installs dependencies, and records the state
4. Validate: `npm test && npm run build`
5. Add credentials to `.env` and sync: `cp .env data/env/env`
6. Register the chat group in the database (see Phase 4 of the channel skill)

Fallback (no pre-built skill — manual pattern):
1. Create `src/channels/{name}.ts` implementing the `Channel` interface from `src/types.ts`
2. Call `registerChannel('{name}', (opts) => ...)` from `src/channels/registry.ts` — channels self-register at startup when credentials are present; no manual wiring in `main()` required
3. Add `import './{name}.js'` to `src/channels/index.ts`

### Adding a New MCP Integration

Questions to ask:
- What service? (Calendar, Notion, database, etc.)
- What operations needed? (read, write, both)
- Which groups should have access?

Implementation:
1. If the MCP server needs filesystem access, add an `additionalMounts` entry to the group's `containerConfig` in the database (see `src/process-runner.ts` for how mounts are passed to the agent process)
2. Document available tools in `groups/CLAUDE.md`

### Changing Assistant Behavior

Questions to ask:
- What aspect? (name, trigger, persona, response style)
- Apply to all groups or specific ones?

#### Changing Identity, Style, or Vibe

The assistant's character is defined in `groups/main/IDENTITY.md`. It contains: **Name**, **Emoji**, **Creature**, **Vibe**, and **Avatar**.

- **`Vibe`** — the assistant's personality and response style (e.g. "sharp, resourceful, a bit chaotic")
- **`Creature`** — the archetype/persona (e.g. "AI familiar", "dragon", "fox")
- **`Emoji`** / **`Avatar`** — visual identity

**Changing style, vibe, or character** (session clear only):

1. Edit `groups/main/IDENTITY.md` — update `Vibe`, `Creature`, `Emoji`, or `Avatar`
2. Stop the service:
   ```bash
   launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
   # Linux: systemctl --user stop nanoclaw
   ```
3. Clear sessions for affected groups:
   ```bash
   sqlite3 store/messages.db "DELETE FROM sessions WHERE group_folder = '{folder}';"
   rm -rf data/sessions/{folder}/.claude
   ```
4. Restart the service:
   ```bash
   launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
   # Linux: systemctl --user start nanoclaw
   ```

**Changing Name** (requires DB update + session clear):

1. Edit `groups/main/IDENTITY.md` — update the `Name` field
2. Update trigger patterns in the database:
   ```bash
   sqlite3 store/messages.db "UPDATE registered_groups SET trigger_pattern = '@NewName' WHERE trigger_pattern = '@OldName';"
   ```
3. Follow steps 2–4 above (stop service, clear sessions, restart)

> ⚠️ If you change the Name without clearing sessions, the agent will keep responding with the old name. The Claude SDK resumes from cached session history, which has the old persona baked in.

#### Changing Behavioral Rules

Use `CLAUDE.md` only when changing **what the assistant does** — instructions, capabilities, response format rules, tool guidance, or group-specific behavior. This is distinct from the assistant's character or vibe.

- `groups/global/CLAUDE.md` — applies to **all groups**
- `groups/{folder}/CLAUDE.md` — applies to that **specific group only**

After editing either file, clear the affected group's session (same steps 2–4 above) so the agent starts fresh with the updated rules.

#### Per-group behavior

Edit the specific group's `CLAUDE.md` at `groups/{folder}/CLAUDE.md`.

### Adding New Commands

Questions to ask:
- What should the command do?
- Available in all groups or main only?
- Does it need new MCP tools?

Implementation:
1. Commands are handled by the agent naturally — add instructions to `groups/CLAUDE.md` or the group's `CLAUDE.md`
2. For trigger-level routing changes, modify `processGroupMessages()` in `src/index.ts`

### Changing Deployment

Questions to ask:
- Target platform? (Linux server, Docker, different Mac)
- Service manager? (systemd, Docker, supervisord)

Implementation:
1. Create appropriate service files
2. Update paths in config
3. Provide setup instructions

## After Changes

Always tell the user:
```bash
# Rebuild and restart
npm run build
# macOS:
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
# Linux:
# systemctl --user restart nanoclaw
```

## Example Interaction

User: "Add Telegram as an input channel"

1. Ask: "Should Telegram use the same @{ASSISTANT_NAME} trigger, or a different one?"
2. Ask: "Should Telegram messages share memory with existing groups, or use a separate folder?"
3. Apply the skill: `npx tsx scripts/apply-skill.ts .claude/skills/add-telegram`
4. Configure credentials in `.env` and sync to `data/env/env`
5. Tell user how to authenticate (QR code / bot token) and register a chat
