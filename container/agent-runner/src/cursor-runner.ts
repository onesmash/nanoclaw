/**
 * Cursor ACP Agent Runner
 * Receives ContainerInput via stdin, runs `agent acp` as a persistent daemon,
 * and outputs ContainerOutput via stdout using the IPC marker protocol.
 * Uses @agentclientprotocol/sdk ClientSideConnection (JSON-RPC 2.0 over stdio).
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
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

function writeMcpJson(mcpJsonPath: string, nanoclaw: Record<string, unknown>): void {
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
  } catch {
    // file doesn't exist or invalid JSON — start fresh
  }

  const mcpServers = (existing.mcpServers as Record<string, unknown>) ?? {};
  mcpServers['nanoclaw'] = nanoclaw;
  existing.mcpServers = mcpServers;

  fs.mkdirSync(path.dirname(mcpJsonPath), { recursive: true });
  fs.writeFileSync(mcpJsonPath, JSON.stringify(existing, null, 2));
}

function syncMcpJson(groupDir: string, mcpServerPath: string, containerInput: ContainerInput): void {
  const nanoclaw = {
    command: process.execPath,
    args: [mcpServerPath],
    env: {
      NANOCLAW_IPC_DIR: process.env.NANOCLAW_IPC_DIR ?? '',
      NANOCLAW_GROUP_FOLDER: containerInput.groupFolder,
      NANOCLAW_IS_MAIN: containerInput.isMain ? '1' : '0',
    },
  };

  const targets = [
    path.join(groupDir, '.cursor', 'mcp.json'),
    path.join(os.homedir(), '.cursor', 'mcp.json'),
  ];

  for (const mcpJsonPath of targets) {
    try {
      writeMcpJson(mcpJsonPath, nanoclaw);
      log(`Synced nanoclaw MCP to ${mcpJsonPath}`);
    } catch (err) {
      log(`Failed to sync mcp.json at ${mcpJsonPath}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

function buildMcpServers(
  mcpServerPath: string,
  containerInput: ContainerInput,
): acp.McpServerStdio[] {
  return [
    {
      name: 'nanoclaw',
      command: process.execPath,
      args: [mcpServerPath],
      env: [
        { name: 'NANOCLAW_IPC_DIR', value: process.env.NANOCLAW_IPC_DIR ?? '' },
        { name: 'NANOCLAW_CHAT_JID', value: containerInput.chatJid },
        { name: 'NANOCLAW_GROUP_FOLDER', value: containerInput.groupFolder },
        { name: 'NANOCLAW_IS_MAIN', value: containerInput.isMain ? '1' : '0' },
      ],
    },
  ];
}

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
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');
  const mcpServers = buildMcpServers(mcpServerPath, containerInput);
  syncMcpJson(groupDir, mcpServerPath, containerInput);
  preApproveMcps(groupDir);
  const ctx = loadSystemContext(containerInput);
  syncAgentsMd(groupDir, ctx);

  const spawnEnv: Record<string, string | undefined> = {
    ...process.env,
    NANOCLAW_CHAT_JID: containerInput.chatJid,
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

  log('Spawning agent acp');
  const agentProc = spawn('agent', ['acp', '--workspace', groupDir, "--approve-mcps", "--force", "--trust"], {
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
        await connection.loadSession({ sessionId, cwd: groupDir, mcpServers });
      } catch (loadErr) {
        log(`Session load failed (${serializeError(loadErr)}), creating new session`);
        sessionId = undefined;
        const r = await connection.newSession({ cwd: groupDir, mcpServers });
        sessionId = r.sessionId;
        log(`New session created: ${sessionId}`);
      }
    } else {
      log('Creating new session');
      const r = await connection.newSession({ cwd: groupDir, mcpServers });
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
    agentProc.kill();
  }
}
