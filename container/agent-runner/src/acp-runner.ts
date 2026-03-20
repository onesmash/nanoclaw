import { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Readable, Writable } from 'stream';

import * as acp from '@agentclientprotocol/sdk';

import {
  ContainerInput,
  applyScheduledTaskPrefix,
  drainIpcInput,
  loadSystemContext,
  readStdin,
  waitForIpcMessage,
  writeOutput,
} from './shared.js';
import { AcpBackendAdapter, AcpRunContext, PreparedRuntime } from './acp-types.js';

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

function log(adapterName: string, message: string): void {
  console.error(`[${adapterName}-runner] ${message}`);
}

function buildPrompt(containerInput: ContainerInput, promptText: string): string {
  return applyScheduledTaskPrefix(promptText, containerInput.isScheduledTask);
}

function buildDefaultSessionParams(
  ctx: AcpRunContext,
  runtime: PreparedRuntime,
): Record<string, unknown> {
  return {
    cwd: runtime.cwd ?? ctx.groupDir,
    mcpServers: runtime.mcpServers ?? [],
  };
}

function buildAgentExitError(
  adapterName: string,
  code: number | null,
  signal: NodeJS.Signals | null,
): Error {
  if (code !== null) {
    return new Error(`${adapterName} ACP process exited with code ${code}`);
  }
  if (signal) {
    return new Error(`${adapterName} ACP process exited with signal ${signal}`);
  }
  return new Error(`${adapterName} ACP process exited unexpectedly`);
}

export async function runAcpAgent<
  TRuntime extends PreparedRuntime = PreparedRuntime,
>(adapter: AcpBackendAdapter<TRuntime>): Promise<void> {
  let containerInput: ContainerInput;

  try {
    const stdinData = await readStdin();
    containerInput = JSON.parse(stdinData);
    log(adapter.name, `Received input for group: ${containerInput.groupFolder}`);
  } catch (err) {
    writeOutput({
      status: 'error',
      result: null,
      error: `Failed to parse input: ${serializeError(err)}`,
    });
    process.exit(1);
    return;
  }

  const groupDir = process.env.NANOCLAW_GROUP_DIR ?? containerInput.groupFolder;
  const projectRoot = process.env.NANOCLAW_PROJECT_ROOT ?? process.cwd();
  const ipcDir = process.env.NANOCLAW_IPC_DIR ?? '';
  const ipcInputDir = path.join(ipcDir, 'input');
  const ipcInputCloseSentinel = path.join(ipcInputDir, '_close');
  const ipcCompactFlag = path.join(ipcInputDir, '_compact');

  try {
    fs.unlinkSync(ipcInputCloseSentinel);
  } catch {
    /* ignore */
  }
  fs.mkdirSync(ipcInputDir, { recursive: true });

  const pending = drainIpcInput(ipcInputDir);
  let initialPromptText = containerInput.prompt;
  if (pending.length > 0) {
    log(adapter.name, `Draining ${pending.length} pending IPC messages into initial prompt`);
    initialPromptText += `\n${pending.join('\n')}`;
  }

  const ctx: AcpRunContext = {
    input: containerInput,
    groupDir,
    projectRoot,
    ipcDir,
    systemContext: loadSystemContext(containerInput),
    initialPrompt: initialPromptText,
  };

  let runtime: TRuntime | undefined;
  let agentProc: ChildProcess | undefined;
  let flowFinished = false;
  let currentSessionId = containerInput.sessionId;
  let loadedPersistedSession = false;
  let promptStarted = false;
  let hadPromptAssistantOutput = false;

  try {
    runtime = adapter.prepareRuntime
      ? await adapter.prepareRuntime(ctx)
      : ({} as TRuntime);
    const preparedRuntime = runtime;

    const spawnedProc = adapter.spawnAgent(ctx, preparedRuntime);
    agentProc = spawnedProc;
    spawnedProc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) log(adapter.name, `stderr: ${text}`);
    });

    const agentExited = new Promise<never>((_, reject) => {
      spawnedProc.once('error', (err: Error) => {
        if (!flowFinished) reject(err);
      });
      spawnedProc.once(
        'close',
        (code: number | null, signal: NodeJS.Signals | null) => {
          if (!flowFinished) {
            reject(buildAgentExitError(adapter.name, code, signal));
          }
        },
      );
    });

    const stream = acp.ndJsonStream(
      Writable.toWeb(spawnedProc.stdin!) as WritableStream<Uint8Array>,
      Readable.toWeb(spawnedProc.stdout!) as ReadableStream<Uint8Array>,
    );

    let textBuffer = '';

    const client: acp.Client = {
      async sessionUpdate(params) {
        const update = params.update;
        if (
          update.sessionUpdate === 'agent_message_chunk' &&
          update.content.type === 'text'
        ) {
          textBuffer += update.content.text;
          hadPromptAssistantOutput = true;
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

    const mainFlow = async (): Promise<void> => {
      const initializeParams = adapter.initializeParams
        ? await adapter.initializeParams(ctx, preparedRuntime)
        : {};
      await connection.initialize({
        protocolVersion: acp.PROTOCOL_VERSION,
        ...initializeParams,
      } as never);

      if (currentSessionId) {
        try {
          log(adapter.name, `Loading session: ${currentSessionId}`);
          const params = adapter.loadSessionParams
            ? await adapter.loadSessionParams(ctx, preparedRuntime, currentSessionId)
            : {
                ...buildDefaultSessionParams(ctx, preparedRuntime),
                sessionId: currentSessionId,
              };
          await connection.loadSession(params as never);
          loadedPersistedSession = true;
        } catch (loadErr) {
          const behavior =
            adapter.onLoadSessionError?.(loadErr, ctx) ?? 'fallback_to_new';
          if (behavior === 'fail') throw loadErr;

          log(
            adapter.name,
            `Session load failed (${serializeError(loadErr)}), creating new session`,
          );
          currentSessionId = undefined;
          const params = adapter.newSessionParams
            ? await adapter.newSessionParams(ctx, preparedRuntime)
            : buildDefaultSessionParams(ctx, preparedRuntime);
          const result = await connection.newSession(params as never);
          currentSessionId = result.sessionId;
          log(adapter.name, `New session created: ${currentSessionId}`);
        }
      } else {
        log(adapter.name, 'Creating new session');
        const params = adapter.newSessionParams
          ? await adapter.newSessionParams(ctx, preparedRuntime)
          : buildDefaultSessionParams(ctx, preparedRuntime);
        const result = await connection.newSession(params as never);
        currentSessionId = result.sessionId;
        log(adapter.name, `New session created: ${currentSessionId}`);
      }

      let currentPromptText = ctx.initialPrompt;
      let isFirstPrompt = true;

      while (true) {
        const prompt = isFirstPrompt
          ? buildPrompt(containerInput, currentPromptText)
          : currentPromptText;
        isFirstPrompt = false;

        log(
          adapter.name,
          `Sending prompt (session: ${currentSessionId}, chars: ${prompt.length})`,
        );

        textBuffer = '';
        hadPromptAssistantOutput = false;
        promptStarted = true;
        await connection.prompt({
          sessionId: currentSessionId,
          prompt: [{ type: 'text', text: prompt }],
        });

        if (textBuffer) {
          writeOutput({
            status: 'success',
            result: textBuffer,
            newSessionId: currentSessionId,
          });
          textBuffer = '';
        }
        writeOutput({
          status: 'success',
          result: null,
          newSessionId: currentSessionId,
        });

        log(adapter.name, 'Prompt complete, waiting for next IPC message...');
        const nextMessage = await waitForIpcMessage(
          ipcInputDir,
          ipcInputCloseSentinel,
          ipcCompactFlag,
        );
        if (nextMessage === null) {
          log(adapter.name, 'Close sentinel received, exiting');
          break;
        }

        log(adapter.name, `Got new message (${nextMessage.length} chars)`);
        currentPromptText = nextMessage;
      }
    };

    await Promise.race([mainFlow(), agentExited]);
    flowFinished = true;
  } catch (err) {
    flowFinished = true;
    const errorMessage = serializeError(err);
    if (loadedPersistedSession && promptStarted) {
      log(
        adapter.name,
        `Session recovery observability: ${JSON.stringify({
          event: 'prompt_phase_session_adjacent_failure',
          sessionId: currentSessionId,
          groupFolder: containerInput.groupFolder,
          hadAssistantOutput: hadPromptAssistantOutput,
          error: errorMessage,
        })}`,
      );
    }
    log(adapter.name, `Agent error: ${errorMessage}`);
    writeOutput({
      status: 'error',
      result: null,
      newSessionId: currentSessionId,
      error: errorMessage,
    });
    process.exit(1);
  } finally {
    flowFinished = true;
    try {
      agentProc?.kill();
    } catch {
      /* ignore */
    }

    if (runtime && adapter.cleanup) {
      try {
        await adapter.cleanup(runtime);
      } catch (cleanupErr) {
        log(adapter.name, `Cleanup error: ${serializeError(cleanupErr)}`);
      }
    }
  }
}
