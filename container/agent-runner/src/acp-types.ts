import { ChildProcess } from 'child_process';

import { ContainerInput, SystemContext } from './shared.js';

export interface PreparedRuntime {
  cwd?: string;
  env?: Record<string, string | undefined>;
  mcpServers?: unknown[];
  tempPaths?: string[];
  childMetadata?: Record<string, unknown>;
}

export interface AcpRunContext {
  input: ContainerInput;
  groupDir: string;
  projectRoot: string;
  ipcDir: string;
  systemContext: SystemContext;
  initialPrompt: string;
}

export interface AcpBackendAdapter<
  TRuntime extends PreparedRuntime = PreparedRuntime,
> {
  name: 'cursor' | 'codex';
  prepareRuntime?(ctx: AcpRunContext): Promise<TRuntime>;
  spawnAgent(ctx: AcpRunContext, runtime: TRuntime): ChildProcess;
  initializeParams?(
    ctx: AcpRunContext,
    runtime: TRuntime,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
  newSessionParams?(
    ctx: AcpRunContext,
    runtime: TRuntime,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
  loadSessionParams?(
    ctx: AcpRunContext,
    runtime: TRuntime,
    sessionId: string,
  ): Promise<Record<string, unknown>> | Record<string, unknown>;
  onLoadSessionError?(
    err: unknown,
    ctx: AcpRunContext,
  ): 'fallback_to_new' | 'fail';
  cleanup?(runtime: TRuntime): Promise<void> | void;
}
