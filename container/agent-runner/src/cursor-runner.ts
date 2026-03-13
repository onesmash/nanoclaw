/**
 * Cursor ACP Agent Runner
 * Receives ContainerInput via stdin, runs `agent acp` as a persistent daemon,
 * and outputs ContainerOutput via stdout using the IPC marker protocol.
 * Uses @agentclientprotocol/sdk ClientSideConnection (JSON-RPC 2.0 over stdio).
 */
import { ChildProcess, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Readable, Writable } from 'stream';
import { fileURLToPath } from 'url';

import * as acp from '@agentclientprotocol/sdk';

import {
  ContainerInput,
  applyScheduledTaskPrefix,
  drainIpcInput,
  loadSystemContext,
  buildSystemPromptAppend,
  readStdin,
  waitForIpcMessage,
  writeOutput,
} from './shared.js';

const IPC_INPUT_DIR = path.join(process.env.NANOCLAW_IPC_DIR ?? '', 'input');
const IPC_INPUT_CLOSE_SENTINEL = path.join(IPC_INPUT_DIR, '_close');

const PROXY_READY_TIMEOUT_MS = 10_000;
const PROXY_POLL_INTERVAL_MS = 200;

function log(message: string): void {
  console.error(`[cursor-runner] ${message}`);
}

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function syncAgentsMd(groupDir: string, ctx: ReturnType<typeof loadSystemContext>): void {
  const agentsMdPath = path.join(groupDir, 'AGENTS.md');
  const systemContent = buildSystemPromptAppend(ctx) ?? '';
  try {
    fs.writeFileSync(agentsMdPath, systemContent, 'utf-8');
    log(`Synced system context to ${agentsMdPath}`);
  } catch (err) {
    log(`Failed to write AGENTS.md: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function preApproveMcps(groupDir: string): void {
  const listResult = spawnSync('agent', ['mcp', 'list'], {
    cwd: groupDir,
    encoding: 'utf-8',
  });

  const output = ((listResult.stdout ?? '') + (listResult.stderr ?? ''))
    .replace(/\x1b\[[0-9;]*[A-Za-z]/g, '');

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

function buildPrompt(containerInput: ContainerInput, promptText: string): string {
  return applyScheduledTaskPrefix(promptText, containerInput.isScheduledTask);
}

// --- MCP proxy helpers ---

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

function resolveConfig(groupDir: string, containerInput: ContainerInput, mcpServerPath: string): McpConfig {
  const mcpJsonPath = path.join(groupDir, '.cursor', 'mcp.json');
  let config: McpConfig = { mcpServers: {} };
  try {
    config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    log(`No mcp.json at ${mcpJsonPath}, using nanoclaw-only default`);
  }

  // Always override the nanoclaw entry with current runtime values
  config.mcpServers['nanoclaw'] = {
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
  const proxyPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'mcp-proxy.js');
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
      await new Promise(r => setTimeout(r, PROXY_POLL_INTERVAL_MS));
    }
  }
  throw new Error(`MCP proxy on port ${port} did not become ready within ${PROXY_READY_TIMEOUT_MS}ms`);
}

// --- main ---

export async function main(): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    log(`Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${err instanceof Error ? err.message : String(err)}`,
    });
    process.exit(1);
  }

  const groupDir = process.env.NANOCLAW_GROUP_DIR ?? containerInput.groupFolder;
  // Agent CLI walks up from cwd to find the git/Cursor workspace root.
  // For groups/main (which lives inside nanoclaw-zoom), the workspace root is
  // always nanoclaw-zoom — not groupDir. We must write .cursor/mcp.json there.
  const projectRoot = process.env.NANOCLAW_PROJECT_ROOT ?? process.cwd();
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  const ctx = loadSystemContext(containerInput);
  syncAgentsMd(groupDir, ctx);

  const spawnEnv: Record<string, string | undefined> = {
    ...process.env,
    NANOCLAW_CHAT_JID: containerInput.chatJid,
    NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
    NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    ...(containerInput.secrets ?? {}),
  };

  try {
    fs.unlinkSync(IPC_INPUT_CLOSE_SENTINEL);
  } catch {
    /* ignore */
  }
  fs.mkdirSync(IPC_INPUT_DIR, { recursive: true });

  const pending = drainIpcInput(IPC_INPUT_DIR);
  let initialPromptText = containerInput.prompt;
  if (pending.length > 0) {
    log(`Draining ${pending.length} pending IPC messages into initial prompt`);
    initialPromptText += '\n' + pending.join('\n');
  }

  // Spawn MCP proxy and wait for it to be ready BEFORE writing mcp.json or spawning
  // the agent. The agent reads mcp.json at startup and immediately tries to connect —
  // if the proxy isn't listening yet, the connection fails and tools won't be available.
  const port = await findFreePort();
  const config = resolveConfig(groupDir, containerInput, mcpServerPath);
  const tmpConfigPath = path.join(os.tmpdir(), `nanoclaw-mcp-${containerInput.groupFolder}-${port}.json`);
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
        const newConfig = resolveConfig(groupDir, containerInput, mcpServerPath);
        fs.writeFileSync(tmpConfigPath, JSON.stringify(newConfig));
        log('mcp.json changed, triggering proxy reload');
        await fetch(`http://127.0.0.1:${port}/reload`, { method: 'POST' })
          .catch((e: unknown) => log(`reload request failed: ${e instanceof Error ? e.message : String(e)}`));
      }, 200);
    });
  } catch {
    log(`Could not watch ${mcpJsonPath}, hot-reload disabled`);
  }

  // Write proxy URL to projectRoot/.cursor/mcp.json.
  // The agent CLI walks up from cwd to the git root (nanoclaw-zoom = projectRoot)
  // and uses that as its workspace, regardless of --workspace groupDir or cwd groupDir.
  // Writing to groupDir/.cursor/mcp.json is silently ignored.
  const cursorDir = path.join(projectRoot, '.cursor');
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(
    path.join(cursorDir, 'mcp.json'),
    JSON.stringify({ mcpServers: { nanoclaw: { url: `http://127.0.0.1:${port}` } } }, null, 2),
  );
  log(`Wrote ${projectRoot}/.cursor/mcp.json with proxy URL http://127.0.0.1:${port}`);

  // Pre-approve from projectRoot (that's the workspace agent actually uses).
  preApproveMcps(projectRoot);

  log('Spawning agent acp');
  const agentProc = spawn('agent', ['acp', '--workspace', groupDir, '--approve-mcps', '--force', '--trust'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: spawnEnv as NodeJS.ProcessEnv,
    cwd: groupDir,
  });

  agentProc.stderr.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log(`stderr: ${text}`);
  });

  const stream = acp.ndJsonStream(
    Writable.toWeb(agentProc.stdin!) as WritableStream<Uint8Array>,
    Readable.toWeb(agentProc.stdout!) as ReadableStream<Uint8Array>,
  );

  let sessionId = containerInput.sessionId;
  let textBuffer = '';

  const client: acp.Client = {
    async sessionUpdate(params) {
      const update = params.update;
      if (update.sessionUpdate === 'agent_message_chunk' && update.content.type === 'text') {
        textBuffer += update.content.text;
      }
    },
    async requestPermission(params) {
      const allowOnce =
        params.options.find((o: acp.PermissionOption) => o.kind === 'allow_once') ??
        params.options[0];
      return { outcome: { outcome: 'selected', optionId: allowOnce.optionId } };
    },
  };

  const connection = new acp.ClientSideConnection((_agent) => client, stream);

  try {
    await connection.initialize({ protocolVersion: acp.PROTOCOL_VERSION });

    if (sessionId) {
      try {
        log(`Loading session: ${sessionId}`);
        await connection.loadSession({ sessionId, cwd: groupDir, mcpServers: [] });
      } catch (loadErr) {
        log(`Session load failed (${serializeError(loadErr)}), creating new session`);
        sessionId = undefined;
        const r = await connection.newSession({ cwd: groupDir, mcpServers: [] });
        sessionId = r.sessionId;
        log(`New session created: ${sessionId}`);
      }
    } else {
      log('Creating new session');
      const r = await connection.newSession({ cwd: groupDir, mcpServers: [] });
      sessionId = r.sessionId;
      log(`New session created: ${sessionId}`);
    }

    let currentPromptText = initialPromptText;
    let isFirstPrompt = true;

    while (true) {
      const prompt = isFirstPrompt
        ? buildPrompt(containerInput, currentPromptText)
        : currentPromptText;
      isFirstPrompt = false;
      log(`Sending prompt (session: ${sessionId}, chars: ${prompt.length})`);

      textBuffer = '';
      await connection.prompt({
        sessionId,
        prompt: [{ type: 'text', text: prompt }],
      });

      if (textBuffer) {
        writeOutput({ status: 'success', result: textBuffer, newSessionId: sessionId });
        textBuffer = '';
      }
      writeOutput({ status: 'success', result: null, newSessionId: sessionId });

      log('Prompt complete, waiting for next IPC message...');
      const nextMessage = await waitForIpcMessage(IPC_INPUT_DIR, IPC_INPUT_CLOSE_SENTINEL);
      if (nextMessage === null) {
        log('Close sentinel received, exiting');
        break;
      }

      log(`Got new message (${nextMessage.length} chars)`);
      currentPromptText = nextMessage;
    }
  } catch (err) {
    const errorMessage = serializeError(err);
    log(`Agent error: ${errorMessage}`);
    writeOutput({ status: 'error', result: null, newSessionId: sessionId, error: errorMessage });
    process.exit(1);
  } finally {
    watcher?.close();
    agentProc.kill();
    proxyProc.kill();
    try { fs.unlinkSync(tmpConfigPath); } catch { /* ignore */ }
  }
}
