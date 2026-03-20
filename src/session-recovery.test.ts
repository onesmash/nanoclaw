import { describe, expect, it, vi } from 'vitest';

import type { ContainerOutput } from './process-runner.js';
import {
  decideSessionRecovery,
  runWithSessionRecovery,
} from './session-recovery.js';

describe('decideSessionRecovery', () => {
  it('retries a claude immediate resume failure with no assistant output', () => {
    expect(
      decideSessionRecovery({
        backend: 'claude',
        sessionId: 'session-1',
        hadAssistantOutput: false,
        attemptedRecovery: false,
        finalError:
          'Process exited with code 1: Claude Code process exited with code 1',
        streamedErrors: ['Agent exited with subtype: error_during_execution'],
      }),
    ).toBe('retry_without_session');
  });

  it('does not retry without a persisted session', () => {
    expect(
      decideSessionRecovery({
        backend: 'claude',
        hadAssistantOutput: false,
        attemptedRecovery: false,
        finalError: 'Claude Code process exited with code 1',
      }),
    ).toBe('do_not_retry');
  });

  it('does not retry after assistant output has begun', () => {
    expect(
      decideSessionRecovery({
        backend: 'claude',
        sessionId: 'session-1',
        hadAssistantOutput: true,
        attemptedRecovery: false,
        finalError: 'Claude Code process exited with code 1',
      }),
    ).toBe('do_not_retry');
  });

  it('does not enable prompt-phase auto-retry for ACP backends', () => {
    expect(
      decideSessionRecovery({
        backend: 'cursor',
        sessionId: 'session-1',
        hadAssistantOutput: false,
        attemptedRecovery: false,
        finalError: 'cursor ACP process exited with code 1',
      }),
    ).toBe('do_not_retry');
  });
});

describe('runWithSessionRecovery', () => {
  it('retries once without session and persists the replacement session', async () => {
    const persisted: string[] = [];
    const onOutput = vi.fn(async (_output: ContainerOutput) => {});
    const runAttempt = vi
      .fn<
        (
          sessionId: string | undefined,
          onOutput: (output: ContainerOutput) => Promise<void>,
        ) => Promise<ContainerOutput>
      >()
      .mockImplementationOnce(async (_sessionId, onAttemptOutput) => {
        await onAttemptOutput({
          status: 'error',
          result: null,
          error: 'Agent exited with subtype: error_during_execution',
        });
        return {
          status: 'error',
          result: null,
          error:
            'Process exited with code 1: Claude Code process exited with code 1',
        };
      })
      .mockImplementationOnce(async (_sessionId, onAttemptOutput) => {
        await onAttemptOutput({
          status: 'success',
          result: 'hello',
          newSessionId: 'replacement-session',
        });
        return {
          status: 'success',
          result: null,
          newSessionId: 'replacement-session',
        };
      });

    const result = await runWithSessionRecovery({
      backend: 'claude',
      groupFolder: 'main',
      sessionId: 'poisoned-session',
      runAttempt,
      onOutput,
      persistSession: (sessionId) => persisted.push(sessionId),
    });

    expect(runAttempt).toHaveBeenNthCalledWith(
      1,
      'poisoned-session',
      expect.any(Function),
    );
    expect(runAttempt).toHaveBeenNthCalledWith(
      2,
      undefined,
      expect.any(Function),
    );
    expect(result.status).toBe('success');
    expect(persisted).toContain('replacement-session');
    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', result: 'hello' }),
    );
    expect(onOutput).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });

  it('does not retry after streamed assistant output has started', async () => {
    const onOutput = vi.fn(async (_output: ContainerOutput) => {});
    const runAttempt = vi.fn<
      (
        sessionId: string | undefined,
        onOutput: (output: ContainerOutput) => Promise<void>,
      ) => Promise<ContainerOutput>
    >(async (_sessionId, onAttemptOutput) => {
      await onAttemptOutput({
        status: 'success',
        result: 'partial output',
        newSessionId: 'session-2',
      });
      await onAttemptOutput({
        status: 'error',
        result: null,
        error: 'Agent exited with subtype: error_during_execution',
      });
      return {
        status: 'error',
        result: null,
        error:
          'Process exited with code 1: Claude Code process exited with code 1',
      };
    });

    const result = await runWithSessionRecovery({
      backend: 'claude',
      groupFolder: 'main',
      sessionId: 'poisoned-session',
      runAttempt,
      onOutput,
    });

    expect(runAttempt).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('error');
    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', result: 'partial output' }),
    );
    expect(onOutput).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error' }),
    );
  });
});
