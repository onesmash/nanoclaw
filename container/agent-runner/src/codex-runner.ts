import { ChildProcess, spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import { AcpBackendAdapter, AcpRunContext, PreparedRuntime } from './acp-types.js';
import { runAcpAgent } from './acp-runner.js';
import { syncAgentsMd } from './shared.js';

export interface CodexLaunchSpec {
  command: string;
  args: string[];
  source: 'override' | 'path' | 'npx';
}

export interface CodexRuntime extends PreparedRuntime {
  launchSpec: CodexLaunchSpec;
}

function log(message: string): void {
  console.error(`[codex-runner] ${message}`);
}

function isTruthy(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

function commandExists(command: string): boolean {
  const checker = process.platform === 'win32' ? 'where' : 'which';
  return spawnSync(checker, [command], { stdio: 'ignore' }).status === 0;
}

function getNpxCommand(): string {
  return process.platform === 'win32' ? 'npx.cmd' : 'npx';
}

export function resolveCodexAcpLaunchSpec(
  env: NodeJS.ProcessEnv = process.env,
): CodexLaunchSpec {
  const override = env.CODEX_ACP_COMMAND?.trim();
  if (override) {
    return { command: override, args: [], source: 'override' };
  }

  if (!isTruthy(env.CODEX_ACP_USE_NPX) && commandExists('codex-acp')) {
    return { command: 'codex-acp', args: [], source: 'path' };
  }

  return {
    command: getNpxCommand(),
    args: ['@zed-industries/codex-acp'],
    source: 'npx',
  };
}

export function buildCodexMcpServers(ctx: AcpRunContext): Array<Record<string, unknown>> {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const mcpServerPath = path.join(__dirname, 'ipc-mcp-stdio.js');

  return [
    {
      name: 'nanoclaw',
      command: process.execPath,
      args: [mcpServerPath],
      env: [
        { name: 'NANOCLAW_IPC_DIR', value: process.env.NANOCLAW_IPC_DIR ?? '' },
        { name: 'NANOCLAW_CHAT_JID', value: ctx.input.chatJid },
        { name: 'NANOCLAW_GROUP_FOLDER', value: ctx.input.groupFolder },
        { name: 'NANOCLAW_IS_MAIN', value: ctx.input.isMain ? '1' : '0' },
      ],
    },
  ];
}

function buildSpawnEnv(ctx: AcpRunContext): Record<string, string | undefined> {
  return {
    ...process.env,
    NANOCLAW_CHAT_JID: ctx.input.chatJid,
    NANOCLAW_GROUP_FOLDER: ctx.input.groupFolder,
    NANOCLAW_IS_MAIN: ctx.input.isMain ? '1' : '0',
    ...(ctx.input.secrets ?? {}),
  };
}

const codexAdapter: AcpBackendAdapter<CodexRuntime> = {
  name: 'codex',
  async prepareRuntime(ctx) {
    syncAgentsMd(ctx.groupDir, ctx.systemContext, log);

    return {
      cwd: ctx.groupDir,
      env: buildSpawnEnv(ctx),
      mcpServers: buildCodexMcpServers(ctx),
      launchSpec: resolveCodexAcpLaunchSpec(),
    };
  },
  spawnAgent(ctx, runtime): ChildProcess {
    log(
      `Spawning Codex ACP via ${runtime.launchSpec.source}: ${runtime.launchSpec.command} ${runtime.launchSpec.args.join(' ')}`.trim(),
    );
    return spawn(runtime.launchSpec.command, runtime.launchSpec.args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: runtime.env as NodeJS.ProcessEnv,
      cwd: ctx.groupDir,
    });
  },
  async newSessionParams(ctx, runtime) {
    return {
      cwd: ctx.groupDir,
      mcpServers: runtime.mcpServers ?? [],
    };
  },
  async loadSessionParams(ctx, runtime, sessionId) {
    return {
      sessionId,
      cwd: ctx.groupDir,
      mcpServers: runtime.mcpServers ?? [],
    };
  },
};

export async function main(): Promise<void> {
  await runAcpAgent(codexAdapter);
}
