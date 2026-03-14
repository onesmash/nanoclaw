import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _initTestDatabase,
  createTask,
  getTaskById,
  logTaskRun,
  updateTask,
  updateTaskAfterRun,
} from './db.js';
import { runContainerAgent } from './process-runner.js';
import {
  _resetSchedulerLoopForTests,
  computeNextRun,
  isHeartbeatContentEffectivelyEmpty,
  startSchedulerLoop,
  stripHeartbeatOk,
} from './task-scheduler.js';

vi.mock('./process-runner.js', () => ({
  runContainerAgent: vi
    .fn()
    .mockResolvedValue({ status: 'success', result: 'ok' }),
  writeTasksSnapshot: vi.fn(),
}));

vi.mock('./db.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./db.js')>();
  return {
    ...actual,
    logTaskRun: vi.fn(),
    updateTaskAfterRun: vi.fn(),
  };
});

describe('stripHeartbeatOk', () => {
  it('returns empty string for pure HEARTBEAT_OK', () => {
    expect(stripHeartbeatOk('HEARTBEAT_OK')).toBe('');
  });

  it('returns empty string when HEARTBEAT_OK at start with short trailing content', () => {
    expect(stripHeartbeatOk('HEARTBEAT_OK short note')).toBe('');
  });

  it('returns empty string when HEARTBEAT_OK at end with short preceding content', () => {
    expect(stripHeartbeatOk('all good HEARTBEAT_OK')).toBe('');
  });

  it('strips HEARTBEAT_OK and returns remainder when trailing content > 300 chars', () => {
    const longAlert = 'A'.repeat(301);
    const result = stripHeartbeatOk(`HEARTBEAT_OK ${longAlert}`);
    expect(result).toBe(longAlert);
  });

  it('returns original text unchanged when no HEARTBEAT_OK present', () => {
    const alert = 'Alert: your server is down!';
    expect(stripHeartbeatOk(alert)).toBe(alert);
  });

  it('returns empty string for markup-wrapped HEARTBEAT_OK', () => {
    expect(stripHeartbeatOk('<b>HEARTBEAT_OK</b>')).toBe('');
  });
});

describe('isHeartbeatContentEffectivelyEmpty', () => {
  it('returns false for null', () => {
    expect(isHeartbeatContentEffectivelyEmpty(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isHeartbeatContentEffectivelyEmpty(undefined)).toBe(false);
  });

  it('returns true for empty string', () => {
    expect(isHeartbeatContentEffectivelyEmpty('')).toBe(true);
  });

  it('returns true for whitespace only', () => {
    expect(isHeartbeatContentEffectivelyEmpty('   \n  \n')).toBe(true);
  });

  it('returns true for ATX header lines only', () => {
    const content = '# HEARTBEAT.md\n\n## Section\n### Sub\n';
    expect(isHeartbeatContentEffectivelyEmpty(content)).toBe(true);
  });

  it('returns true for template content (current HEARTBEAT.md default)', () => {
    const template =
      '# HEARTBEAT.md\n\n# Keep this file empty (or with only comments) to skip heartbeat API calls.\n\n# Add tasks below when you want the agent to check something periodically.\n';
    expect(isHeartbeatContentEffectivelyEmpty(template)).toBe(true);
  });

  it('returns true for empty markdown list items', () => {
    expect(isHeartbeatContentEffectivelyEmpty('- [ ]\n* \n+ [x]\n')).toBe(true);
  });

  it('returns false for actionable list item', () => {
    expect(isHeartbeatContentEffectivelyEmpty('- check email')).toBe(false);
  });

  it('returns false for #tag without space (not an ATX header)', () => {
    expect(isHeartbeatContentEffectivelyEmpty('#TODO')).toBe(false);
    expect(isHeartbeatContentEffectivelyEmpty('#hashtag')).toBe(false);
  });

  it('returns false when mixed: comments + one actionable line', () => {
    const content = '# Header\n\n- check calendar\n';
    expect(isHeartbeatContentEffectivelyEmpty(content)).toBe(false);
  });
});

describe('task scheduler', () => {
  beforeEach(() => {
    _initTestDatabase();
    _resetSchedulerLoopForTests();
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('pauses due tasks with invalid group folders to prevent retry churn', async () => {
    createTask({
      id: 'task-invalid-folder',
      group_folder: '../../outside',
      chat_jid: 'bad@g.us',
      prompt: 'run',
      schedule_type: 'once',
      schedule_value: '2026-02-22T00:00:00.000Z',
      context_mode: 'isolated',
      next_run: new Date(Date.now() - 60_000).toISOString(),
      status: 'active',
      created_at: '2026-02-22T00:00:00.000Z',
    });

    const enqueueTask = vi.fn(
      (_groupJid: string, _taskId: string, fn: () => Promise<void>) => {
        void fn();
      },
    );

    startSchedulerLoop({
      registeredGroups: () => ({}),
      getSessions: () => ({}),
      queue: { enqueueTask } as any,
      onProcess: () => {},
      sendMessage: async () => {},
    });

    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('task-invalid-folder');
    expect(task?.status).toBe('paused');
  });

  it('computeNextRun anchors interval tasks to scheduled time to prevent drift', () => {
    const scheduledTime = new Date(Date.now() - 2000).toISOString(); // 2s ago
    const task = {
      id: 'drift-test',
      group_folder: 'test',
      chat_jid: 'test@g.us',
      prompt: 'test',
      schedule_type: 'interval' as const,
      schedule_value: '60000', // 1 minute
      context_mode: 'isolated' as const,
      next_run: scheduledTime,
      last_run: null,
      last_result: null,
      status: 'active' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const nextRun = computeNextRun(task);
    expect(nextRun).not.toBeNull();

    // Should be anchored to scheduledTime + 60s, NOT Date.now() + 60s
    const expected = new Date(scheduledTime).getTime() + 60000;
    expect(new Date(nextRun!).getTime()).toBe(expected);
  });

  it('computeNextRun returns null for once-tasks', () => {
    const task = {
      id: 'once-test',
      group_folder: 'test',
      chat_jid: 'test@g.us',
      prompt: 'test',
      schedule_type: 'once' as const,
      schedule_value: '2026-01-01T00:00:00.000Z',
      context_mode: 'isolated' as const,
      next_run: new Date(Date.now() - 1000).toISOString(),
      last_run: null,
      last_result: null,
      status: 'active' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    expect(computeNextRun(task)).toBeNull();
  });

  it('computeNextRun skips missed intervals without infinite loop', () => {
    // Task was due 10 intervals ago (missed)
    const ms = 60000;
    const missedBy = ms * 10;
    const scheduledTime = new Date(Date.now() - missedBy).toISOString();

    const task = {
      id: 'skip-test',
      group_folder: 'test',
      chat_jid: 'test@g.us',
      prompt: 'test',
      schedule_type: 'interval' as const,
      schedule_value: String(ms),
      context_mode: 'isolated' as const,
      next_run: scheduledTime,
      last_run: null,
      last_result: null,
      status: 'active' as const,
      created_at: '2026-01-01T00:00:00.000Z',
    };

    const nextRun = computeNextRun(task);
    expect(nextRun).not.toBeNull();
    // Must be in the future
    expect(new Date(nextRun!).getTime()).toBeGreaterThan(Date.now());
    // Must be aligned to the original schedule grid
    const offset =
      (new Date(nextRun!).getTime() - new Date(scheduledTime).getTime()) % ms;
    expect(offset).toBe(0);
  });

  it('skips heartbeat and advances next_run when HEARTBEAT.md is template-only', async () => {
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'readFileSync').mockImplementation((filePath) => {
      if (String(filePath).endsWith('HEARTBEAT.md')) {
        return '# HEARTBEAT.md\n\n# Keep this file empty.\n';
      }
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    createTask({
      id: 'heartbeat-skip-test',
      group_folder: 'main',
      chat_jid: 'main@g.us',
      prompt: 'Read HEARTBEAT.md',
      schedule_type: 'interval',
      schedule_value: '1800000',
      context_mode: 'group',
      next_run: new Date(Date.now() - 60_000).toISOString(),
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      task_type: 'heartbeat',
    });

    const enqueueTask = vi.fn(
      (_groupJid: string, _taskId: string, fn: () => Promise<void>) => {
        void fn();
      },
    );

    startSchedulerLoop({
      registeredGroups: () => ({
        'main@g.us': {
          jid: 'main@g.us',
          name: 'Main',
          folder: 'main',
          isMain: true,
          trigger: '@Andy',
          added_at: '2026-01-01T00:00:00.000Z',
        },
      }),
      getSessions: () => ({}),
      queue: { enqueueTask } as any,
      onProcess: () => {},
      sendMessage: async () => {},
    });

    await vi.advanceTimersByTimeAsync(10);

    expect(runContainerAgent).not.toHaveBeenCalled();
    expect(logTaskRun).not.toHaveBeenCalled();
    expect(updateTaskAfterRun).toHaveBeenCalledWith(
      'heartbeat-skip-test',
      expect.anything(),
      'Skipped: empty HEARTBEAT.md',
    );
  });

  it('runs heartbeat normally when HEARTBEAT.md is absent (ENOENT)', async () => {
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    });

    createTask({
      id: 'heartbeat-enoent-test',
      group_folder: 'main',
      chat_jid: 'main@g.us',
      prompt: 'Read HEARTBEAT.md',
      schedule_type: 'interval',
      schedule_value: '1800000',
      context_mode: 'group',
      next_run: new Date(Date.now() - 60_000).toISOString(),
      status: 'active',
      created_at: '2026-01-01T00:00:00.000Z',
      task_type: 'heartbeat',
    });

    const enqueueTask = vi.fn(
      (_groupJid: string, _taskId: string, fn: () => Promise<void>) => {
        void fn();
      },
    );

    startSchedulerLoop({
      registeredGroups: () => ({
        'main@g.us': {
          jid: 'main@g.us',
          name: 'Main',
          folder: 'main',
          isMain: true,
          trigger: '@Andy',
          added_at: '2026-01-01T00:00:00.000Z',
        },
      }),
      getSessions: () => ({}),
      queue: { enqueueTask } as any,
      onProcess: () => {},
      sendMessage: async () => {},
    });

    await vi.advanceTimersByTimeAsync(10);

    expect(runContainerAgent).toHaveBeenCalled();
  });
});

describe('retry logic', () => {
  const BASE_TASK = {
    group_folder: 'test-group',
    chat_jid: 'test@g.us',
    prompt: 'do something',
    schedule_type: 'interval' as const,
    schedule_value: '3600000',
    context_mode: 'isolated' as const,
    status: 'active' as const,
    created_at: '2026-01-01T00:00:00.000Z',
  };

  const REGISTERED_GROUPS = {
    'test@g.us': {
      jid: 'test@g.us',
      name: 'Test',
      folder: 'test-group',
      isMain: false,
      trigger: '@bot',
      added_at: '2026-01-01T00:00:00.000Z',
    },
  };

  beforeEach(() => {
    _initTestDatabase();
    _resetSchedulerLoopForTests();
    vi.useFakeTimers();
    vi.clearAllMocks();
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function runScheduler(sendMessage = vi.fn().mockResolvedValue(undefined)) {
    const enqueueTask = vi.fn(
      (_jid: string, _id: string, fn: () => Promise<void>) => {
        void fn();
      },
    );
    startSchedulerLoop({
      registeredGroups: () => REGISTERED_GROUPS,
      getSessions: () => ({}),
      queue: { enqueueTask } as any,
      onProcess: () => {},
      sendMessage,
    });
    return { sendMessage };
  }

  it('first failure increments consecutive_errors and schedules backoff retry', async () => {
    vi.mocked(runContainerAgent).mockResolvedValueOnce({
      status: 'error',
      error: 'connection timeout',
      result: null,
    });

    const before = Date.now();
    createTask({
      ...BASE_TASK,
      id: 'retry-first',
      next_run: new Date(before - 1000).toISOString(),
    });

    const { sendMessage } = runScheduler();
    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('retry-first');
    expect(task?.consecutive_errors).toBe(1);
    const nextRunMs = new Date(task!.next_run!).getTime();
    expect(nextRunMs).toBeGreaterThanOrEqual(before + 30_000 - 500);
    expect(nextRunMs).toBeLessThanOrEqual(before + 30_000 + 1000);
    expect(sendMessage).toHaveBeenCalledWith(
      'test@g.us',
      expect.stringContaining('attempt 1/3'),
    );
  });

  it('backoff is capped by naturalNext when interval is shorter than backoff', async () => {
    vi.mocked(runContainerAgent).mockResolvedValueOnce({
      status: 'error',
      error: 'timeout',
      result: null,
    });

    const now = Date.now();
    createTask({
      ...BASE_TASK,
      id: 'retry-cap',
      schedule_value: '10000',
      next_run: new Date(now - 1000).toISOString(),
    });

    runScheduler();
    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('retry-cap');
    const nextRunMs = new Date(task!.next_run!).getTime();
    // naturalNext = (now - 1000) + 10000 ≈ now + 9000, backoff = now + 30000
    expect(nextRunMs).toBeLessThan(now + 30_000);
    expect(nextRunMs).toBeGreaterThanOrEqual(now + 7_000);
  });

  it('recurring task resets consecutive_errors and restores natural schedule after MAX_RETRIES', async () => {
    vi.mocked(runContainerAgent).mockResolvedValueOnce({
      status: 'error',
      error: 'persistent error',
      result: null,
    });

    const now = Date.now();
    createTask({
      ...BASE_TASK,
      id: 'retry-max-recurring',
      next_run: new Date(now - 1000).toISOString(),
    });
    updateTask('retry-max-recurring', { consecutive_errors: 2 });

    runScheduler();
    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('retry-max-recurring');
    expect(task?.consecutive_errors).toBe(0);
    expect(task?.status).toBe('active');
  });

  it('once task is paused and consecutive_errors preserved after MAX_RETRIES', async () => {
    vi.mocked(runContainerAgent).mockResolvedValueOnce({
      status: 'error',
      error: 'final error',
      result: null,
    });

    const now = Date.now();
    createTask({
      ...BASE_TASK,
      id: 'retry-max-once',
      schedule_type: 'once',
      schedule_value: '2026-01-01T00:00:00.000Z',
      next_run: new Date(now - 1000).toISOString(),
    });
    updateTask('retry-max-once', { consecutive_errors: 2 });

    runScheduler();
    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('retry-max-once');
    expect(task?.status).toBe('paused');
    expect(task?.consecutive_errors).toBe(3);
  });

  it('success resets consecutive_errors to 0', async () => {
    vi.mocked(runContainerAgent).mockResolvedValueOnce({
      status: 'success',
      result: 'done',
    });

    const now = Date.now();
    createTask({
      ...BASE_TASK,
      id: 'retry-success-reset',
      next_run: new Date(now - 1000).toISOString(),
    });
    updateTask('retry-success-reset', { consecutive_errors: 2 });

    runScheduler();
    await vi.advanceTimersByTimeAsync(10);

    const task = getTaskById('retry-success-reset');
    expect(task?.consecutive_errors).toBe(0);
  });
});
