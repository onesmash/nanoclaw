/**
 * Cursor ACP Agent Runner
 * Thin adapter over the shared ACP runtime.
 */
import { ChildProcess, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { AcpBackendAdapter, PreparedRuntime } from './acp-types.js';
import { runAcpAgent } from './acp-runner.js';
import { ContainerInput, SystemContext, syncAgentsMd } from './shared.js';

const PROXY_READY_TIMEOUT_MS = 10_000;
const PROXY_POLL_INTERVAL_MS = 200;

function log(message: string): void {
  console.error(`[cursor-runner] ${message}`);
}

function preApproveMcps(groupDir: string): void {
  const listResult = spawnSync('agent', ['mcp', 'list'], {
    cwd: groupDir,
    encoding: 'utf-8',
  });

  const output = ((listResult.stdout ?? '') + (listResult.stderr ?? '')).replace(
    /\x1b\[[0-9;]*[A-Za-z]/g,
    '',
  );

  const needsApproval = output
    .split('\n')
    .filter((line) => line.includes('needs approval'))
    .map((line) => line.split(':')[0].trim())
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

type McpConfig = { mcpServers: Record<string, unknown> };

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

function resolveConfig(
  groupDir: string,
  containerInput: ContainerInput,
  mcpServerPath: string,
): McpConfig {
  const mcpJsonPath = path.join(groupDir, '.cursor', 'mcp.json');
  let config: McpConfig = { mcpServers: {} };
  try {
    config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    log(`No mcp.json at ${mcpJsonPath}, using nanoclaw-only default`);
  }

  config.mcpServers.nanoclaw = {
    command: process.execPath,
    args: [mcpServerPath],
    env: {
      NANOCLAW_IPC_DIR: process.env.NANOCLAW_IPC_DIR ?? '',
      NANOCLAW_CHAT_JID: containerInput.chatJid,
      NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
      NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    },
  };

  return config;
}

function spawnProxy(port: number, configPath: string): ChildProcess {
  const proxyPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'mcp-proxy.js',
  );
  const proc = spawn(process.execPath, [proxyPath, String(port), configPath], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  proc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log(`proxy: ${text}`);
  });
  return proc;
}

async function waitForProxy(port: number): Promise<void> {
  const deadline = Date.now() + PROXY_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, PROXY_POLL_INTERVAL_MS));
    }
  }
  throw new Error(
    `MCP proxy on port ${port} did not become ready within ${PROXY_READY_TIMEOUT_MS}ms`,
  );
}

interface CursorRuntime extends PreparedRuntime {
  proxyProc: ChildProcess;
  tmpConfigPath: string;
  watcher: fs.FSWatcher | null;
  reloadTimer: ReturnType<typeof setTimeout> | null;
}

function buildSpawnEnv(
  containerInput: ContainerInput,
): Record<string, string | undefined> {
  return {
    ...process.env,
    NANOCLAW_CHAT_JID: containerInput.chatJid,
    NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
    NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    ...(containerInput.secrets ?? {}),
  };
}

function syncCursorAgentsMd(groupDir: string, ctx: SystemContext): void {
  syncAgentsMd(groupDir, ctx, log);
}

const cursorAdapter: AcpBackendAdapter<CursorRuntime> = {
  name: 'cursor',
  async prepareRuntime(ctx) {
    const groupDir = ctx.groupDir;
    const projectRoot = ctx.projectRoot;
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

    syncCursorAgentsMd(groupDir, ctx.systemContext);

    const port = await findFreePort();
    const config = resolveConfig(groupDir, ctx.input, mcpServerPath);
    const tmpConfigPath = path.join(
      os.tmpdir(),
      `nanoclaw-mcp-${ctx.input.groupFolder}-${port}.json`,
    );
    fs.writeFileSync(tmpConfigPath, JSON.stringify(config));

    const proxyProc = spawnProxy(port, tmpConfigPath);
    log(`Spawning MCP proxy on port ${port}`);
    await waitForProxy(port);
    log(`MCP proxy ready on port ${port}`);

    const mcpJsonPath = path.join(groupDir, '.cursor', 'mcp.json');
    let reloadTimer: ReturnType<typeof setTimeout> | null = null;
    let watcher: fs.FSWatcher | null = null;
    try {
      watcher = fs.watch(mcpJsonPath, { persistent: false }, () => {
        if (reloadTimer) clearTimeout(reloadTimer);
        reloadTimer = setTimeout(async () => {
          reloadTimer = null;
          const newConfig = resolveConfig(groupDir, ctx.input, mcpServerPath);
          fs.writeFileSync(tmpConfigPath, JSON.stringify(newConfig));
          log('mcp.json changed, triggering proxy reload');
          await fetch(`http://127.0.0.1:${port}/reload`, { method: 'POST' }).catch(
            (e: unknown) =>
              log(
                `reload request failed: ${e instanceof Error ? e.message : String(e)}`,
              ),
          );
        }, 200);
      });
    } catch {
      log(`Could not watch ${mcpJsonPath}, hot-reload disabled`);
    }

    const cursorDir = path.join(projectRoot, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    const mcpJsonWritePath = path.join(cursorDir, 'mcp.json');
    try {
      if (fs.lstatSync(mcpJsonWritePath).isSymbolicLink()) {
        fs.unlinkSync(mcpJsonWritePath);
        log(`Broke symlink at ${mcpJsonWritePath}, replacing with plain file`);
      }
    } catch {
      /* path does not exist */
    }
    fs.writeFileSync(
      mcpJsonWritePath,
      JSON.stringify(
        { mcpServers: { nanoclaw: { url: `http://127.0.0.1:${port}` } } },
        null,
        2,
      ),
    );
    log(`Wrote ${mcpJsonWritePath} with proxy URL http://127.0.0.1:${port}`);

    const preCompactPath = path.join(__dirname, 'pre-compact.js');
    const hooksJsonPath = path.join(cursorDir, 'hooks.json');
    let hooksConfig: Record<string, unknown> = { version: 1 };
    try {
      hooksConfig = JSON.parse(fs.readFileSync(hooksJsonPath, 'utf-8'));
    } catch {
      /* no existing config */
    }
    if (!hooksConfig.version) hooksConfig.version = 1;
    const hooks = (hooksConfig.hooks ?? {}) as Record<string, unknown[]>;
    const preCompactEntry = { command: `node ${preCompactPath}` };
    const existing = (hooks.preCompact ?? []) as Array<Record<string, unknown>>;
    hooks.preCompact = [
      ...existing.filter((entry) => entry.command !== preCompactEntry.command),
      preCompactEntry,
    ];
    hooksConfig.hooks = hooks;
    fs.writeFileSync(hooksJsonPath, JSON.stringify(hooksConfig, null, 2));
    log('Wrote hooks.json with preCompact hook');

    preApproveMcps(projectRoot);

    return {
      cwd: groupDir,
      env: buildSpawnEnv(ctx.input),
      mcpServers: [],
      proxyProc,
      tmpConfigPath,
      watcher,
      reloadTimer,
    };
  },
  spawnAgent(ctx, runtime): ChildProcess {
    log('Spawning agent acp');
    return spawn(
      'agent',
      ['acp', '--workspace', ctx.groupDir, '--approve-mcps', '--force', '--trust'],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: runtime.env as NodeJS.ProcessEnv,
        cwd: ctx.groupDir,
      },
    );
  },
  async newSessionParams(ctx) {
    return { cwd: ctx.groupDir, mcpServers: [] };
  },
  async loadSessionParams(ctx, _runtime, sessionId) {
    return { sessionId, cwd: ctx.groupDir, mcpServers: [] };
  },
  async cleanup(runtime) {
    runtime.watcher?.close();
    if (runtime.reloadTimer) clearTimeout(runtime.reloadTimer);
    runtime.proxyProc.kill();
    try {
      fs.unlinkSync(runtime.tmpConfigPath);
    } catch {
      /* ignore */
    }
  },
};

export async function main(): Promise<void> {
  await runAcpAgent(cursorAdapter);
}
