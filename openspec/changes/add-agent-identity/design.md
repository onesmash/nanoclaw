# Design: Agent Identity File

## Context

NanoClaw currently reads the assistant name from `ASSISTANT_NAME` in `.env`. This is invisible (buried in env config), flat (name only), and gives the running agent no structured sense of self beyond a string. openclaw (the upstream project) has a richer `IDENTITY.md` mechanism with name, emoji, creature, vibe, and avatar fields parsed into a structured type.

This change ports that pattern to nanoclaw-office as a global, project-root file.

## Goals / Non-Goals

- **Goals**:
  - Replace `ASSISTANT_NAME` env var with `IDENTITY.md` as sole source of truth for the assistant name
  - Make emoji, creature, and vibe available to the agent at runtime via system prompt
  - Keep the trigger pattern (`@{name}`) working exactly as before
  - Both runners (process-runner) propagate the identity file path via `NANOCLAW_IDENTITY_PATH`
  - Setup skill guides user through identity creation conversationally on first run
  - Customize skill allows updating any identity field

- **Non-Goals**:
  - Per-group identity overrides (global only)
  - Avatar rendering in any channel (field stored but unused at runtime)
  - Migrating existing `.env` files automatically

## Decisions

### File location: project root

`IDENTITY.md` lives at the project root alongside `CLAUDE.md` and `AGENTS.md`. This makes it discoverable and consistent with the workspace file convention.

Alternatives considered:
- `groups/global/IDENTITY.md` — already mounted into non-main agents, but semantically wrong (identity is project-level, not group-memory)
- `.env`-style — already rejected; goal is human-readable file

### Parsing: startup-time, synchronous, cached

`src/identity.ts` reads and parses `IDENTITY.md` once at process startup using `fs.readFileSync`. Result is module-level cached. No file watching.

Rationale: identity changes require a service restart anyway (to rebuild trigger pattern and clear agent sessions).

### Propagation: NANOCLAW_IDENTITY_PATH env var

Process runner passes the full host path via `NANOCLAW_IDENTITY_PATH`. Agent runner reads the file directly. This is consistent with how `NANOCLAW_GROUP_DIR`, `NANOCLAW_IPC_DIR`, etc. are passed.

### Fallback behavior

If `IDENTITY.md` is missing or `name` is empty, `getAssistantName()` returns `'Andy'`. Existing deployments without an `IDENTITY.md` continue to work unchanged.

### Placeholder filtering

Openclaw's template ships with placeholder values like `_(pick something you like)_`. The parser detects and discards these so an unfilled template is treated as empty.

## Risks / Trade-offs

- **Breaking change**: removing `ASSISTANT_NAME` from `.env` — mitigated by clear fallback to `'Andy'` and documentation
- **Restart required for identity changes** — acceptable; same as current behavior for name changes

## Migration Plan

1. Deploy new code (identity.ts, config.ts, process-runner.ts, agent-runner)
2. If `IDENTITY.md` exists with a name → uses that name immediately
3. If `IDENTITY.md` missing → falls back to `'Andy'` (same as current default)
4. Existing `.env` `ASSISTANT_NAME` values are silently ignored after this change — document in release notes

## Open Questions

- None; all decisions made during brainstorming session.
