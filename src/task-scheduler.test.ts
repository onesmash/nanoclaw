import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  _initTestDatabase,
  createTask,
  getTaskById,
  logTaskRun,
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
