/**
 * Debug script: verify agent acp can see nanoclaw tools.
 *
 * Tests in order:
 *   Test A: nanoclaw via STDIO entry in workspace mcp.json
 *   Test B: nanoclaw via HTTP proxy entry in workspace mcp.json
 *
 * Usage: npm run build && node dist/debug-mcp-proxy.js
 */

import { spawn, spawnSync, ChildProcess } from 'child_process';
import fs from 'fs';
import net from 'net';
import os from 'os';
import path from 'path';
import { Readable, Writable } from 'stream';
import { fileURLToPath } from 'url';

import * as acp from '@agentclientprotocol/sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(msg: string) {
  process.stderr.write(`[debug] ${msg}\n`);
}

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

async function waitForUrl(url: string, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { await fetch(url); return; } catch { /* keep polling */ }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`${url} not ready within ${timeoutMs}ms`);
}

async function runAgentAcpPrompt(
  groupDir: string,
  promptText: string,
  extraArgs: string[] = [],
): Promise<string> {
  const agentProc = spawn('agent', ['acp', ...extraArgs], {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env },
    cwd: groupDir,
  });

  agentProc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log(`agent stderr: ${text}`);
  });

  const stream = acp.ndJsonStream(
    Writable.toWeb(agentProc.stdin!) as WritableStream<Uint8Array>,
    Readable.toWeb(agentProc.stdout!) as ReadableStream<Uint8Array>,
  );

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
    const { sessionId } = await connection.newSession({ cwd: groupDir, mcpServers: [] });
    textBuffer = '';
    await connection.prompt({ sessionId, prompt: [{ type: 'text', text: promptText }] });
    return textBuffer;
  } finally {
    agentProc.kill();
  }
}

async function testA_stdio(ipcDir: string): Promise<void> {
  log('\n========== TEST A: stdio nanoclaw in workspace mcp.json ==========');

  const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-debug-A-'));
  try {
    const cursorDir = path.join(groupDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify({
      mcpServers: {
        nanoclaw: {
          command: process.execPath,
          args: [path.join(__dirname, 'ipc-mcp-stdio.js')],
          env: {
            NANOCLAW_IPC_DIR: ipcDir,
            NANOCLAW_CHAT_JID: 'debug@test',
            NANOCLAW_GROUP_FOLDER: 'debug',
            NANOCLAW_IS_MAIN: '1',
          },
        },
      },
    }, null, 2));
    log(`groupDir: ${groupDir}`);

    log('Running agent mcp enable nanoclaw...');
    const r = spawnSync('agent', ['mcp', 'enable', 'nanoclaw'], { cwd: groupDir, encoding: 'utf-8' });
    log(`enable result: ${(r.stdout + r.stderr).replace(/\x1b\[[^m]*m/g, '').trim()}`);

    log('Sending probe prompt to agent acp...');
    const result = await runAgentAcpPrompt(
      groupDir,
      'Call the nanoclaw__send_message tool with text="hello-stdio-test". If not available, say TOOL NOT FOUND.',
    );
    log(`\nAgent response:\n${result}`);
    log(result.includes('TOOL NOT FOUND') ? '❌ FAIL: nanoclaw tool not available' : '✅ PASS: nanoclaw tool was invoked');
  } finally {
    fs.rmSync(groupDir, { recursive: true, force: true });
  }
}

async function testB_httpProxy(ipcDir: string): Promise<void> {
  log('\n========== TEST B: HTTP proxy in workspace mcp.json ==========');

  const groupDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-debug-B-'));
  const proxyPath = path.join(__dirname, 'mcp-proxy.js');
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  const config = {
    mcpServers: {
      nanoclaw: {
        command: process.execPath,
        args: [mcpServerPath],
        env: {
          NANOCLAW_IPC_DIR: ipcDir,
          NANOCLAW_CHAT_JID: 'debug@test',
          NANOCLAW_GROUP_FOLDER: 'debug',
          NANOCLAW_IS_MAIN: '1',
        },
      },
    },
  };

  const port = await findFreePort();
  const configPath = path.join(os.tmpdir(), `nanoclaw-mcp-debug-${port}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config));

  const proxyProc: ChildProcess = spawn(process.execPath, [proxyPath, String(port), configPath], {
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  proxyProc.stderr!.on('data', (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) log(`proxy: ${text}`);
  });

  try {
    await waitForUrl(`http://127.0.0.1:${port}/`);
    log(`Proxy ready on http://127.0.0.1:${port}`);

    const cursorDir = path.join(groupDir, '.cursor');
    fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(path.join(cursorDir, 'mcp.json'), JSON.stringify({
      mcpServers: {
        'mcp-proxy': { url: `http://127.0.0.1:${port}` },
      },
    }, null, 2));
    log(`groupDir: ${groupDir}`);

    log('Running agent mcp enable mcp-proxy...');
    const r = spawnSync('agent', ['mcp', 'enable', 'mcp-proxy'], { cwd: groupDir, encoding: 'utf-8' });
    log(`enable result: ${(r.stdout + r.stderr).replace(/\x1b\[[^m]*m/g, '').trim()}`);

    // preApproveMcps in cursor-runner.ts also does this — verify it works
    const mcpListResult = spawnSync('agent', ['mcp', 'list'], { cwd: groupDir, encoding: 'utf-8' });
    log(`mcp list: ${(mcpListResult.stdout + mcpListResult.stderr).replace(/\x1b\[[^m]*m/g, '').trim()}`);

    log('Checking agent mcp list...');
    const lr = spawnSync('agent', ['mcp', 'list'], { cwd: groupDir, encoding: 'utf-8' });
    log(`mcp list:\n${(lr.stdout + lr.stderr).replace(/\x1b\[[^m]*m/g, '').trim()}`);

    log('Sending probe prompt to agent acp...');
    const result = await runAgentAcpPrompt(
      groupDir,
      'Call the nanoclaw__send_message tool with text="hello-proxy-test". If not available, say TOOL NOT FOUND.',
    );
    log(`\nAgent response:\n${result}`);
    log(result.includes('TOOL NOT FOUND') ? '❌ FAIL: nanoclaw tool not available via proxy' : '✅ PASS: nanoclaw tool was invoked via proxy');
  } finally {
    proxyProc.kill();
    fs.rmSync(groupDir, { recursive: true, force: true });
    try { fs.unlinkSync(configPath); } catch { /* ignore */ }
  }
}

async function main() {
  const ipcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-ipc-'));
  fs.mkdirSync(ipcDir, { recursive: true });
  log(`IPC dir: ${ipcDir}`);

  try {
    await testA_stdio(ipcDir);
    await testB_httpProxy(ipcDir);
  } finally {
    fs.rmSync(ipcDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  process.stderr.write(`[debug] Fatal: ${err}\n`);
  process.exit(1);
});
