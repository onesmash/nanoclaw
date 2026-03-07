## 1. Core Identity Module

- [x] 1.1 Create `src/identity.ts` — `AgentIdentity` type, `parseIdentityMarkdown()`, `loadAgentIdentity()`, `getAssistantName()`
- [x] 1.2 Add placeholder-value filter (port from openclaw's `identity-file.ts`)
- [x] 1.3 Update `src/config.ts` — derive `ASSISTANT_NAME` from `getAssistantName()`, remove `ASSISTANT_NAME` from `readEnvFile([...])`

## 2. Process Runner Propagation

- [x] 2.1 Update `src/process-runner.ts` `buildEnv()` — add `NANOCLAW_IDENTITY_PATH: path.join(process.cwd(), 'IDENTITY.md')`

## 3. Agent Runner System Prompt

- [x] 3.1 Update `container/agent-runner/src/index.ts` — read `NANOCLAW_IDENTITY_PATH ?? '/workspace/identity.md'`, inject into system prompt when file exists

## 4. Project Root IDENTITY.md Template

- [x] 4.1 Create `IDENTITY.md` at project root with current identity values and openclaw-format fields

## 5. Skill Updates

- [x] 5.1 Update `.claude/skills/setup/SKILL.md` — add conversational identity setup step (after channel setup, before mount allowlist); skip if `IDENTITY.md` already has a name
- [x] 5.2 Update `.claude/skills/customize/SKILL.md` — replace "Changing the Assistant Name" with "Changing Identity"; cover all fields; distinguish name-change (needs DB + session clear) from other fields (session clear only); update Key Files table to remove `.env` `ASSISTANT_NAME` entry

## 6. Validation

- [x] 6.1 Run `npm run build` — confirm TypeScript compiles without errors
- [x] 6.2 Run `npm test` — confirm existing tests pass
