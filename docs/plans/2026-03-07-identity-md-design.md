# IDENTITY.md Loading Mechanism

Date: 2026-03-07

## Goal

Add a structured `IDENTITY.md` file at the project root that defines the assistant's identity (name, emoji, creature, vibe, avatar). This replaces the `ASSISTANT_NAME` env var and makes identity a first-class, human-readable config.

## Decisions

- **Scope**: Global single identity — one `IDENTITY.md` at the project root
- **Fields**: Full openclaw format — name, emoji, creature, vibe, avatar
- **Replaces**: `ASSISTANT_NAME` in `.env` entirely (no fallback to env var)
- **Trigger pattern**: `name` from `IDENTITY.md` drives `@{name}` trigger and system prompt identity
- **Fallback**: If `IDENTITY.md` missing or name empty, defaults to `'Andy'`

## File Format

```markdown
# IDENTITY.md - Who Am I?

- **Name:** Looong
- **Creature:** AI familiar
- **Vibe:** sharp, warm, a bit chaotic
- **Emoji:** 🐉
- **Avatar:** (optional workspace-relative path or URL)
```

Placeholder values (e.g. "pick something you like") are filtered out and treated as unset.

## Architecture

### `src/identity.ts` (new)

Parses `IDENTITY.md` at startup, cached in memory.

```typescript
export type AgentIdentity = {
  name?: string;
  emoji?: string;
  creature?: string;
  vibe?: string;
  avatar?: string;
};

export function loadAgentIdentity(projectRoot?: string): AgentIdentity
export function getAssistantName(): string  // returns identity.name ?? 'Andy'
```

Parsing logic mirrors openclaw's `identity-file.ts`:
- Strip markdown bold/italic markers
- Strip surrounding parentheses from values
- Filter known placeholder strings (case-insensitive)

### `src/config.ts`

- Remove `ASSISTANT_NAME` from `readEnvFile([...])` call
- `ASSISTANT_NAME` becomes: `getAssistantName()` from `identity.ts`
- `TRIGGER_PATTERN` unchanged — still derived from `ASSISTANT_NAME`

### `src/process-runner.ts`

Add to `buildEnv()`:

```typescript
NANOCLAW_IDENTITY_PATH: path.join(process.cwd(), 'IDENTITY.md'),
```

Same pattern as `NANOCLAW_GROUP_DIR`, `NANOCLAW_IPC_DIR`, `NANOCLAW_GLOBAL_DIR`.

### `container/agent-runner/src/index.ts`

Read identity file and inject into system prompt:

```typescript
const identityPath = process.env.NANOCLAW_IDENTITY_PATH ?? '/workspace/identity.md';
// If file exists, include contents as a section in the system prompt
```

## Files Changed

| File | Change |
|------|--------|
| `IDENTITY.md` | New — project root, openclaw format |
| `src/identity.ts` | New — parser + `loadAgentIdentity()` + `getAssistantName()` |
| `src/config.ts` | `ASSISTANT_NAME` reads from `identity.ts` instead of `.env` |
| `src/process-runner.ts` | `buildEnv()` adds `NANOCLAW_IDENTITY_PATH` |
| `container/agent-runner/src/index.ts` | Reads identity file, injects into system prompt |
| `.claude/skills/setup/SKILL.md` | Add identity setup step before starting service — conversational flow, see below |
| `.claude/skills/customize/SKILL.md` | Replace "Changing the Assistant Name" with "Changing Identity" — edits any field in `IDENTITY.md` (name, emoji, creature, vibe, avatar); only name change requires DB trigger update + session clear |

## Identity Setup Flow (in setup skill)

Insert as a new step between channel setup and mount allowlist.

Open with:

> "Hey. I just came online. Who am I? Who are you?"

Then guide through four fields one at a time, offering suggestions if they're stuck:

1. **Name** — What should they call you? (offer suggestions based on vibe, e.g. "Nova", "Orion", "Pip")
2. **Creature** — What kind of entity are you? (AI assistant is fine, but maybe something weirder — familiar, ghost, daemon, oracle)
3. **Vibe** — Formal? Casual? Snarky? Warm? A mix?
4. **Emoji** — Everyone needs a signature

After collecting answers, write `IDENTITY.md` to the project root. If the user skips a field, leave it blank (don't insert placeholder text).

Skip this step if `IDENTITY.md` already exists and has a name set.

## Backward Compatibility

- No `IDENTITY.md` → name defaults to `'Andy'`, behaviour unchanged
- Existing `.env` `ASSISTANT_NAME` entries are ignored once `IDENTITY.md` is present
- No changes to `RegisteredGroup` schema or database
