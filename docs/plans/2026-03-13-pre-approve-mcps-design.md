# Design: Pre-Approve MCPs Before ACP Session

## Problem

Currently `cursor-runner` does a fire-and-forget `cursor agent mcp enable nanoclaw` after `syncMcpJson()`. This is non-blocking and only handles nanoclaw. If the approval hasn't landed by the time the ACP session starts, MCPs may not be ready.

## Solution

Replace the fire-and-forget with a blocking `preApproveMcps(groupDir)` call that:
1. Lists all MCPs that need approval in the `groupDir` workspace
2. Approves each one before starting the ACP session

## Flow

```
syncMcpJson()
↓
preApproveMcps(groupDir)   ← blocking, runs before ACP
  ├─ agent mcp list        (from groupDir, ~1-2s)
  ├─ parse "needs approval" lines
  └─ agent mcp enable <name>  (for each, ~2-3s each, errors ignored)
↓
spawn('agent', ['acp', ...])
```

## Implementation

Add `spawnSync` import, add function, replace fire-and-forget in `main()`:

```typescript
import { spawn, spawnSync } from 'child_process';

function preApproveMcps(groupDir: string): void {
  const listResult = spawnSync('agent', ['mcp', 'list'], {
    cwd: groupDir,
    encoding: 'utf-8',
  });

  const output = ((listResult.stdout ?? '') + (listResult.stderr ?? ''))
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, ''); // strip ANSI

  const needsApproval = output
    .split('\n')
    .filter(line => line.includes('needs approval'))
    .map(line => line.split(':')[0].trim())
    .filter(Boolean);

  if (needsApproval.length === 0) {
    log('All MCPs already approved');
    return;
  }

  log(`Pre-approving MCPs: ${needsApproval.join(', ')}`);
  for (const name of needsApproval) {
    spawnSync('agent', ['mcp', 'enable', name], {
      cwd: groupDir,
      encoding: 'utf-8',
    });
    log(`Approved MCP: ${name}`);
  }
}
```

In `main()`, replace:
```typescript
// Remove:
const approveProc = spawn('cursor', ['agent', 'mcp', 'enable', 'nanoclaw'], {
  detached: true,
  stdio: 'ignore',
  cwd: groupDir,
});
approveProc.unref();

// Add:
preApproveMcps(groupDir);
```

## Key Decisions

- **`agent` not `cursor agent`**: `cursor agent` is just a wrapper that delegates to `~/.local/bin/cursor-agent`. Using `agent` directly is consistent with how the ACP process is spawned and avoids the version-check overhead.
- **Blocking**: Ensures MCPs are approved before ACP starts, eliminating race conditions.
- **All MCPs**: Approves everything marked "needs approval", not just nanoclaw.
- **Errors ignored**: If `enable` fails (binary not found, etc.), ACP still starts — `--approve-mcps` provides a fallback.
- **No timeout**: Callers rely on the cursor daemon being available; no additional timeout needed.

## `agent mcp list` Output Format

```
gitnexus: ready
DevHelper: ready
nanoclaw: not loaded (needs approval)
peekaboo: not loaded (needs approval)
```

Lines matching `needs approval` are parsed; MCP name is the substring before `:`.
