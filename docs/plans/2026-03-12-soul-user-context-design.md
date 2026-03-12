# SOUL.md & USER.md System Context Design

## Overview

Add two new global context files — `SOUL.md` and `USER.md` — to the agent system prompt, alongside the existing `IDENTITY.md`.

## Background

The current `loadSystemContext` assembles the agent's system prompt from several files:

| File | Location | Purpose |
|------|----------|---------|
| `IDENTITY.md` | `groups/main/` | Agent's specific persona/name |
| `CLAUDE.md` | `groups/global/` | Global instructions (non-main groups only) |
| `BOOTSTRAP.md` | per-group dir | Group-specific startup instructions |
| `TOOLS.md` | per-group dir | Tool usage instructions |

Two files are missing: a place to define the agent's **values and personality** (SOUL), and a place to describe the **user** the agent is serving (USER).

## Proposed Files

### `groups/main/SOUL.md`
Agent's personality, values, and behavioral principles. Examples:
- Communication style (direct, warm, concise)
- Core values (honesty, helpfulness, curiosity)
- What to do / avoid in all contexts

### `groups/main/USER.md`
Context about the person the agent serves. Examples:
- User's name, role, background
- Preferences and habits
- Timezone, language, work patterns

Both files are **global** — shared across all groups, like `IDENTITY.md`. Files are optional; if absent, they are silently skipped.

## Implementation Plan

### 1. `src/process-runner.ts`

Add two env vars in `buildEnv()`, alongside `NANOCLAW_IDENTITY_PATH`:

```ts
NANOCLAW_SOUL_PATH: path.join(GROUPS_DIR, 'main', 'SOUL.md'),
NANOCLAW_USER_PATH: path.join(GROUPS_DIR, 'main', 'USER.md'),
```

### 2. `container/agent-runner/src/shared.ts`

Add fields to `SystemContext`:

```ts
export interface SystemContext {
  soulContent?: string;
  identityContent?: string;
  userContent?: string;
  globalClaudeMd?: string;
  bootstrapContent?: string;
  toolsContent?: string;
  extraDirs: string[];
}
```

Load them in `loadSystemContext`:

```ts
const readIfExists = (p: string | undefined) =>
  p && fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : undefined;

const soulContent = readIfExists(process.env.NANOCLAW_SOUL_PATH);
const userContent = readIfExists(process.env.NANOCLAW_USER_PATH);
```

Add `buildSystemPromptAppend` to centralize assembly (used by both runners):

```ts
export function buildSystemPromptAppend(ctx: SystemContext): string | undefined {
  const parts = [
    ctx.soulContent,
    ctx.identityContent,
    ctx.userContent,
    ctx.globalClaudeMd,
    ctx.bootstrapContent,
    ctx.toolsContent,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
```

### 3. `container/agent-runner/src/claude-runner.ts`

Replace inline parts assembly:

```ts
// before
const parts = [ctx.identityContent, ctx.globalClaudeMd, ...].filter(Boolean);
return parts.length > 0 ? { type: 'preset', ..., append: parts.join('\n\n') } : undefined;

// after
const append = buildSystemPromptAppend(ctx);
return append ? { type: 'preset', preset: 'claude_code', append } : undefined;
```

### 4. `container/agent-runner/src/cursor-runner.ts`

Replace inline parts assembly in `buildPrompt`:

```ts
// before
const systemPrefix = [ctx.identityContent, ...].filter(Boolean).join('\n\n');

// after
const systemPrefix = buildSystemPromptAppend(ctx);
```

## System Prompt Order

```
SOUL → IDENTITY → USER → CLAUDE.md → BOOTSTRAP → TOOLS
```

Rationale: fundamental character first, then persona, then user context, then operational instructions.

## Usage

Create files at:
- `groups/main/SOUL.md` — agent personality and values
- `groups/main/USER.md` — user profile and preferences

Both are optional. Restart the service after creating or editing them.
