import type { ContainerOutput } from './process-runner.js';

export type AgentBackend = 'claude' | 'cursor' | 'codex';
export type SessionRecoveryDecision = 'do_not_retry' | 'retry_without_session';

export interface SessionRecoveryDecisionInput {
  backend: AgentBackend;
  sessionId?: string;
  hadAssistantOutput: boolean;
  attemptedRecovery: boolean;
  finalError?: string;
  streamedErrors?: string[];
}

export interface SessionRecoveryAttemptState {
  hadAssistantOutput: boolean;
  streamedErrorOutputs: ContainerOutput[];
  streamedErrors: string[];
}

export interface SessionRecoveryLogContext {
  backend: AgentBackend;
  groupFolder: string;
  sessionId?: string;
  finalError?: string;
  streamedErrors: string[];
}

export interface RunWithSessionRecoveryOptions {
  backend: AgentBackend;
  groupFolder: string;
  sessionId?: string;
  runAttempt: (
    sessionId: string | undefined,
    onOutput: (output: ContainerOutput) => Promise<void>,
  ) => Promise<ContainerOutput>;
  onOutput?: (output: ContainerOutput) => Promise<void>;
  persistSession?: (sessionId: string) => void;
  logRecoveryRetry?: (context: SessionRecoveryLogContext) => void;
  logRecoverySkip?: (
    decision: SessionRecoveryDecision,
    context: SessionRecoveryLogContext,
  ) => void;
}

function collectErrorTexts(
  finalError: string | undefined,
  streamedErrors: string[],
): string {
  return [finalError, ...streamedErrors].filter(Boolean).join('\n');
}

export function decideSessionRecovery(
  input: SessionRecoveryDecisionInput,
): SessionRecoveryDecision {
  if (!input.sessionId || input.hadAssistantOutput || input.attemptedRecovery) {
    return 'do_not_retry';
  }

  if (input.backend !== 'claude') {
    return 'do_not_retry';
  }

  const combinedError = collectErrorTexts(
    input.finalError,
    input.streamedErrors ?? [],
  );
  const hasKnownClaudeResumeFailure =
    combinedError.includes('error_during_execution') ||
    combinedError.includes('Claude Code process exited');

  return hasKnownClaudeResumeFailure
    ? 'retry_without_session'
    : 'do_not_retry';
}

async function flushBufferedErrors(
  onOutput: ((output: ContainerOutput) => Promise<void>) | undefined,
  outputs: ContainerOutput[],
): Promise<void> {
  if (!onOutput) return;
  for (const output of outputs) {
    await onOutput(output);
  }
}

function buildAttemptState(): SessionRecoveryAttemptState {
  return {
    hadAssistantOutput: false,
    streamedErrorOutputs: [],
    streamedErrors: [],
  };
}

export async function runWithSessionRecovery(
  options: RunWithSessionRecoveryOptions,
): Promise<ContainerOutput> {
  const createOnOutput =
    (state: SessionRecoveryAttemptState) => async (output: ContainerOutput) => {
      if (output.status === 'error') {
        state.streamedErrorOutputs.push(output);
        if (output.error) {
          state.streamedErrors.push(output.error);
        }
        return;
      }

      if (output.newSessionId) {
        options.persistSession?.(output.newSessionId);
      }
      if (output.result) {
        state.hadAssistantOutput = true;
      }
      await options.onOutput?.(output);
    };

  const firstState = buildAttemptState();
  const firstOutput = await options.runAttempt(
    options.sessionId,
    createOnOutput(firstState),
  );
  if (firstOutput.status !== 'error') {
    if (firstOutput.newSessionId) {
      options.persistSession?.(firstOutput.newSessionId);
    }
    return firstOutput;
  }

  const firstContext: SessionRecoveryLogContext = {
    backend: options.backend,
    groupFolder: options.groupFolder,
    sessionId: options.sessionId,
    finalError: firstOutput.error,
    streamedErrors: firstState.streamedErrors,
  };
  const decision = decideSessionRecovery({
    backend: options.backend,
    sessionId: options.sessionId,
    hadAssistantOutput: firstState.hadAssistantOutput,
    attemptedRecovery: false,
    finalError: firstOutput.error,
    streamedErrors: firstState.streamedErrors,
  });

  if (decision === 'do_not_retry') {
    options.logRecoverySkip?.(decision, firstContext);
    await flushBufferedErrors(options.onOutput, firstState.streamedErrorOutputs);
    return firstOutput;
  }

  options.logRecoveryRetry?.(firstContext);

  const secondState = buildAttemptState();
  const secondOutput = await options.runAttempt(undefined, createOnOutput(secondState));

  if (secondOutput.status !== 'error') {
    if (secondOutput.newSessionId) {
      options.persistSession?.(secondOutput.newSessionId);
    }
    return secondOutput;
  }

  await flushBufferedErrors(options.onOutput, secondState.streamedErrorOutputs);
  return secondOutput;
}
