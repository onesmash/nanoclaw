# Change: Add Agent Identity File (IDENTITY.md)

## Why

The assistant name is currently set via `ASSISTANT_NAME` in `.env`, which is hidden, flat, and gives the agent no sense of identity beyond a bare name. Adding a structured `IDENTITY.md` file at the project root makes identity a first-class, human-readable config — name, emoji, creature, and vibe — that the agent can read and embody at runtime.

## What Changes

- **BREAKING**: `ASSISTANT_NAME` env var removed; name is now read from `IDENTITY.md`
- New `IDENTITY.md` file at project root (name, emoji, creature, vibe, avatar fields)
- New `src/identity.ts` module: parses `IDENTITY.md`, exports `getAssistantName()`
- `src/config.ts`: `ASSISTANT_NAME` derived from `identity.ts` instead of `.env`
- `src/process-runner.ts`: `buildEnv()` passes `NANOCLAW_IDENTITY_PATH` to agent subprocess
- `container/agent-runner/src/index.ts`: reads identity file, injects into system prompt
- `.claude/skills/setup/SKILL.md`: new conversational identity setup step during onboarding
- `.claude/skills/customize/SKILL.md`: "Changing Identity" section replaces "Changing Assistant Name"

## Impact

- Affected specs: `agent-identity` (new), `identity-lifecycle` (new)
- Affected code: `src/config.ts`, `src/process-runner.ts`, `src/identity.ts` (new), `container/agent-runner/src/index.ts`
- Affected skills: `.claude/skills/setup/SKILL.md`, `.claude/skills/customize/SKILL.md`
