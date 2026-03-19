# Codex ACP Backend Design

Date: 2026-03-19

## Summary

This design adds `zed-industries/codex-acp` as a new NanoClaw agent backend and refactors the existing ACP-based backend path into a reusable runtime.

After this change:

- `claude` remains a standalone backend
- `cursor` and `codex` share a common `acp-runner`
- backend-specific runtime setup stays in thin adapters
- MCP integration remains adapter-owned, not protocol-owned
- the main NanoClaw process keeps the current `OUTPUT_START/END` contract unchanged

## Context

NanoClaw already has a container-side backend split:

- `claude-runner.ts` uses the Claude Agent SDK directly
- `cursor-runner.ts` uses ACP with a persistent `agent acp` subprocess

The current `cursor-runner.ts` mixes several concerns in one file:

- ACP client lifecycle
- session creation and loading
- prompt loop and IPC ingestion
- permission handling
- output translation
- Cursor-specific runtime setup
- Cursor-specific MCP proxy and config management

Adding Codex by copying `cursor-runner.ts` would duplicate protocol logic and create long-term drift. The right boundary is to extract a shared ACP runtime and keep backend-specific setup in adapters.

## Goals

- Add `AGENT_BACKEND=codex`
- Support persistent ACP sessions for Codex
- Support `loadSession` for resumed Codex conversations
- Reuse one ACP runtime for both Cursor and Codex
- Keep MCP logic backend-specific
- Preserve the current process-runner contract and streaming behavior

## Non-Goals

- Unify Claude with ACP backends
- Introduce a plugin framework for all future backends
- Redesign NanoClaw's top-level orchestrator
- Change the current IPC file protocol

## High-Level Architecture

### Backend split

- `claude` continues to dispatch to `claude-runner.ts`
- `cursor` dispatches to a thin Cursor adapter
- `codex` dispatches to a thin Codex adapter
- both adapters call a shared `acp-runner`

### Proposed file structure

- `container/agent-runner/src/index.ts`
  - dispatches `claude` | `cursor` | `codex`
- `container/agent-runner/src/shared.ts`
  - keeps `ContainerInput`, `ContainerOutput`, marker helpers, IPC helpers, system-context helpers
- `container/agent-runner/src/acp-runner.ts`
  - common ACP runtime
- `container/agent-runner/src/cursor-runner.ts`
  - Cursor adapter entrypoint
- `container/agent-runner/src/codex-runner.ts`
  - Codex adapter entrypoint
- `container/agent-runner/src/acp-types.ts`
  - optional shared ACP adapter/runtime types

## ACP Runtime Boundary

`acp-runner.ts` owns protocol and lifecycle behavior only.

It is responsible for:

- reading `ContainerInput` from stdin
- preparing the common run context
- calling adapter runtime hooks
- spawning the backend ACP subprocess
- creating the ACP stream and client connection
- calling `initialize`
- calling `loadSession` or `newSession`
- sending prompts into the active session
- receiving streaming updates
- handling permission requests
- draining IPC messages and continuing the same session
- translating ACP results into NanoClaw marker output
- cleanup on exit

It is explicitly not responsible for:

- MCP server creation
- MCP proxy lifecycle
- backend-specific config files
- backend-specific workspace files
- backend-specific binary resolution rules

## Adapter Boundary

Each ACP backend provides a thin adapter that owns runtime preparation for that backend.

It is responsible for:

- backend-specific file and directory preparation
- backend-specific environment variables
- MCP setup and teardown
- backend-specific subprocess spawn command
- backend-specific session parameter construction

It is explicitly not responsible for:

- managing the ACP prompt loop
- handling session update streaming
- deciding permission responses
- translating output into NanoClaw markers

## Types

### Adapter interface

```ts
interface AcpBackendAdapter {
  name: 'cursor' | 'codex';
  prepareRuntime?(ctx: AcpRunContext): Promise<PreparedRuntime>;
  spawnAgent(ctx: AcpRunContext, runtime: PreparedRuntime): ChildProcess;
  initializeParams?(ctx: AcpRunContext, runtime: PreparedRuntime): Record<string, unknown>;
  newSessionParams?(ctx: AcpRunContext, runtime: PreparedRuntime): Promise<Record<string, unknown>>;
  loadSessionParams?(
    ctx: AcpRunContext,
    runtime: PreparedRuntime,
    sessionId: string,
  ): Promise<Record<string, unknown>>;
  onLoadSessionError?(err: unknown, ctx: AcpRunContext): 'fallback_to_new' | 'fail';
  cleanup?(runtime: PreparedRuntime): Promise<void>;
}
```

### Runtime state

```ts
interface PreparedRuntime {
  env?: Record<string, string | undefined>;
  cwd?: string;
  mcpServers?: unknown[];
  tempPaths?: string[];
  childMetadata?: Record<string, unknown>;
}
```

### Run context

```ts
interface AcpRunContext {
  input: ContainerInput;
  groupDir: string;
  projectRoot: string;
  ipcDir: string;
  systemContext: SystemContext;
  initialPrompt: string;
}
```

## End-to-End Data Flow

### Startup

1. `src/process-runner.ts` spawns `container/agent-runner/dist/index.js`
2. `index.ts` reads `AGENT_BACKEND`
3. `claude` goes to `claude-runner.ts`
4. `cursor` and `codex` each build their adapter and call `runAcpAgent(adapter)`

### ACP session creation

1. `acp-runner` reads stdin JSON
2. `acp-runner` builds the common run context
3. `acp-runner` drains pending IPC input into the initial prompt
4. `acp-runner` calls `adapter.prepareRuntime()`
5. `acp-runner` calls `adapter.spawnAgent()`
6. `acp-runner` creates the ACP client connection
7. `acp-runner` calls `initialize()`
8. if `sessionId` exists, `acp-runner` tries `loadSession(...)`
9. if no `sessionId`, or if `loadSession` fails and adapter allows fallback, `acp-runner` calls `newSession(...)`

### Prompt loop

1. `acp-runner` sends the initial prompt into the active session
2. ACP `sessionUpdate` events stream back
3. text deltas are accumulated and emitted through `writeOutput(...)`
4. once a prompt turn completes, `acp-runner` emits a final success marker with `result: null`
5. `acp-runner` waits for the next IPC message
6. if a new message arrives, it is sent into the same session with another `prompt(...)`
7. if the close sentinel arrives, the runner exits

### Shutdown

1. `acp-runner` stops watchers
2. `acp-runner` terminates the child ACP process
3. `acp-runner` calls `adapter.cleanup()`
4. temp files and proxy state owned by the adapter are removed

## Session Strategy

### Session creation

- sessions are long-lived while the ACP subprocess remains alive
- `newSession` is used when no prior `sessionId` exists
- the resulting `sessionId` is streamed back in `ContainerOutput.newSessionId`

### Session resumption

- `loadSession` is attempted whenever `ContainerInput.sessionId` is present
- adapters may choose the failure behavior via `onLoadSessionError`
- default backend behavior should be `fallback_to_new`

### Session continuity

- one ACP subprocess serves one active NanoClaw conversation process
- all IPC follow-up messages are appended to the same loaded or created session
- `src/process-runner.ts` remains the source of truth for persisting the active `sessionId`

## Prompt Construction

Prompt semantics remain shared across ACP backends:

- `applyScheduledTaskPrefix(...)` is reused
- pending IPC files are drained before the first turn
- subsequent IPC messages are sent as follow-up prompts in the same session

Prompt behavior should not diverge between Cursor and Codex unless a backend-specific bug forces it. The protocol runtime should not encode provider-specific prompt shaping.

## System Context

The existing shared system-context helpers remain the canonical source:

- `loadSystemContext(...)`
- `buildSystemPromptAppend(...)`

If a backend needs files on disk for context injection, that is handled by its adapter in `prepareRuntime()`.

Examples:

- syncing `AGENTS.md`
- writing backend-specific config files
- preparing hooks or helper files

## MCP Design

MCP stays entirely inside the adapter boundary.

This is intentional:

- Cursor already has backend-specific MCP proxy behavior
- Codex may need a different MCP registration mechanism
- `acp-runner` should not assume any one MCP transport or config model

### Cursor MCP ownership

The Cursor adapter continues to own:

- local MCP proxy creation
- `.cursor/mcp.json` management
- `hooks.json` preparation
- MCP approval bootstrap
- any Cursor workspace-specific MCP conventions

### Codex MCP ownership

The Codex adapter owns:

- how NanoClaw MCP tools are exposed to `codex-acp`
- whether MCP servers are passed directly through ACP session parameters or prepared through runtime files
- any Codex-specific config or bridge process

The runtime only sees whatever backend session parameters the adapter returns.

## Cursor Adapter Design

The refactored Cursor adapter keeps current Cursor-specific behavior but removes protocol ownership.

Responsibilities:

- sync `AGENTS.md`
- prepare `.cursor/` runtime files
- prepare `hooks.json`
- start and stop the current MCP proxy if still required
- pre-approve MCPs if Cursor still requires it
- build Cursor session parameters
- spawn:

```bash
agent acp --workspace <groupDir> --approve-mcps --force --trust
```

The adapter no longer owns:

- prompt loop
- ACP connection lifecycle
- `sessionUpdate` handling
- marker output translation

## Codex Adapter Design

The new Codex adapter provides the same ACP runtime contract for `zed-industries/codex-acp`.

Responsibilities:

- prepare any Codex-specific runtime files
- sync shared context files if Codex needs them on disk
- provide Codex-specific environment variables
- define Codex MCP setup and teardown
- build Codex session parameters
- spawn the Codex ACP agent

Supported auth inputs should include:

- `OPENAI_API_KEY`
- `CODEX_API_KEY`

Command resolution order should be:

1. explicit override such as `CODEX_ACP_COMMAND`
2. `codex-acp` on `PATH`
3. `npx @zed-industries/codex-acp`

This keeps the design flexible for local development, pinned installations, and containerized environments.

## Configuration Changes

### `src/config.ts`

`AGENT_BACKEND` expands from:

- `claude`
- `cursor`

to:

- `claude`
- `cursor`
- `codex`

### Secret pass-through

`src/process-runner.ts` should expand the allowed secret set to include Codex credentials:

- `OPENAI_API_KEY`
- `CODEX_API_KEY`

Existing Claude-related secrets remain untouched.

### Optional backend-specific env

The design allows optional backend-specific overrides such as:

- `CODEX_ACP_COMMAND`
- `CODEX_ACP_USE_NPX`

These are implementation details and do not change the top-level orchestration model.

## Output Contract

The main process contract does not change.

`acp-runner` must continue to emit:

- `writeOutput({ status: 'success', result: <text>, newSessionId })` for streamed text
- `writeOutput({ status: 'success', result: null, newSessionId })` when a turn completes successfully
- `writeOutput({ status: 'error', result: null, error, newSessionId })` on failures

This preserves compatibility with:

- `src/process-runner.ts`
- existing output parsing
- timeout reset behavior
- session persistence behavior

## Permission Handling

Permission behavior stays in the common ACP runtime.

The runtime should:

- implement a shared `requestPermission(...)` callback
- prefer an `allow_once` option when available
- otherwise fall back to the first provided option

This keeps user-visible behavior aligned across Cursor and Codex and avoids adapter-specific permission drift.

## Error Handling

The runtime should normalize these failure classes:

- invalid stdin input
- runtime preparation failure
- agent spawn failure
- ACP initialization failure
- session load failure
- session creation failure
- prompt execution failure
- unexpected subprocess exit
- cleanup failure

Handling rules:

- the first unrecoverable protocol error becomes the emitted `status: error`
- cleanup failures are logged but do not replace the primary error
- `loadSession` failure may fall back to `newSession` if the adapter allows it
- partial streamed output does not automatically imply a successful turn

## Testing Strategy

### ACP runtime tests

Add focused tests for `acp-runner` that mock the ACP connection and verify:

- `initialize` is called
- `loadSession` is used when `sessionId` exists
- `newSession` is used otherwise
- streamed text is emitted through marker output
- prompt completion emits the trailing `result: null`
- close sentinel exits the loop
- permission selection is consistent

### Adapter tests

Cursor adapter tests should verify:

- runtime files are created correctly
- MCP proxy setup is correct
- spawn parameters are correct

Codex adapter tests should verify:

- command resolution is correct
- env injection is correct
- runtime preparation is correct
- session params are built correctly

### Existing process contract tests

Keep `src/process-runner.test.ts` as the top-level contract test and extend it where needed so the main process remains backend-agnostic.

## Trade-Offs

### Why not copy `cursor-runner.ts`?

That would be faster short-term but would duplicate:

- session lifecycle logic
- IPC prompt loop
- permission handling
- streaming output translation
- error behavior

This design pays a one-time refactor cost to avoid long-term backend drift.

### Why not move MCP into the common runtime?

Because MCP behavior is not protocol-generic in this codebase. Cursor already needs backend-specific setup, and Codex is likely to need different setup. Keeping MCP in adapters preserves a clean runtime boundary.

### Why not unify Claude too?

Claude does not use ACP here and already has a mature direct SDK path. Forcing it into this abstraction would make the design worse, not better.

## Risks

- refactoring Cursor into an adapter may accidentally change current behavior
- Codex runtime requirements may differ more than expected from Cursor
- session loading semantics may need backend-specific fallback behavior
- MCP integration for Codex may require additional runtime files or a bridge process

## Mitigations

- keep the output contract unchanged
- add runtime-level tests before adding Codex behavior
- migrate Cursor onto `acp-runner` first and validate no behavior drift
- keep adapter hooks narrow and explicit

## Rollout Plan

1. Introduce `acp-runner` and adapter types
2. Port Cursor to the adapter model without changing behavior
3. Add `AGENT_BACKEND=codex`
4. Implement the Codex adapter
5. Extend config and secret pass-through
6. Add targeted tests for the runtime and adapters
7. Validate all three backends: `claude`, `cursor`, `codex`

## Final Recommendation

Adopt this design:

- keep `claude` standalone
- create one shared `acp-runner`
- move `cursor` and `codex` to thin adapters
- keep MCP fully adapter-owned
- preserve the current NanoClaw process contract

This gives NanoClaw a clean Codex integration path without turning backend support into copy-paste maintenance.
