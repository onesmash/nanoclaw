# Change: Establish Group mcp.json as Read-Only Pre-Proxy Source Config

## Why

The two-file convention for MCP configuration has never been formally specified, causing
confusion about which file serves which role and whether cursor-runner should write to
`{groupDir}/.cursor/mcp.json`. This change formalises the invariant in the spec.

Current code already implements the correct behaviour:
- `resolveConfig()` reads `{groupDir}/.cursor/mcp.json` (user-managed source)
- nanoclaw (ipc-mcp-stdio) entry is added in-memory with current session env vars
- proxy URL is written to `{projectRoot}/.cursor/mcp.json` (runtime output)
- cursor-runner never writes to `{groupDir}/.cursor/mcp.json`

The spec delta captures this as a requirement so future changes do not accidentally break
the invariant.

## Two-File Invariant

| File | Role | Managed by | Contains |
|------|------|-----------|----------|
| `groups/{name}/.cursor/mcp.json` | Pre-proxy source config | User / setup (written once) | User-defined servers only — nanoclaw entry added in-memory by `resolveConfig()` |
| `.cursor/mcp.json` (project root) | Runtime proxy endpoint | cursor-runner (per session) | `mcp-proxy: { url: "http://127.0.0.1:<port>" }` |

## What Changes

- **Spec delta only**: `specs/cursor-agent-execution/spec.md` — MODIFIED: MCP Server
  Aggregation requirement formalises the read-only source file role and in-memory nanoclaw
  injection behaviour.

No code changes required — the implementation already matches the convention.

## Impact

- Affected specs: `cursor-agent-execution` (MODIFIED: MCP Server Aggregation)
- Affected code: none
- Risk: NONE
