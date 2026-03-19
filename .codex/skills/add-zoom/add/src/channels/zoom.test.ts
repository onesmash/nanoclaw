import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// --- Mocks ---

vi.mock('./registry.js', () => ({ registerChannel: vi.fn() }));
vi.mock('../env.js', () => ({ readEnvFile: vi.fn(() => ({})) }));
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Andy',
  TRIGGER_PATTERN: /^@Andy\b/i,
}));
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- ws mock ---

const wsInstances = vi.hoisted(() => ({ current: null as MockWS | null }));

class MockWS extends EventEmitter {
  static OPEN = 1;
  static CLOSED = 3;
  readyState = MockWS.OPEN;
  ping = vi.fn();
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = MockWS.CLOSED;
  });

  constructor(_url: string, _opts?: unknown) {
    super();
    wsInstances.current = this;
  }
}
MockWS.OPEN = 1;
MockWS.CLOSED = 3;

vi.mock('ws', () => ({ default: MockWS }));

// --- fetch mock ---

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

// --- Helpers ---

function makeTokenResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'tok_test', expires_in: 3600 }),
  } as Response;
}

function makeSendResponse(status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({}),
  } as Response;
}

function makeReactionResponse(reactionId = 'rxn_001') {
  return {
    ok: true,
    status: 200,
    json: async () => ({ reaction_id: reactionId }),
  } as Response;
}

function buildAppMentionPayload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    module: 'message',
    content: JSON.stringify({
      event: 'team_chat.app_mention',
      payload: {
        account_id: 'acct_001',
        operator_id: 'user_001',
        operator_jid: 'user_001@xmpp.zoom.us',
        object: {
          channel_id: 'ch_001',
          message: '@TestBot hello world',
          robot_name: 'TestBot',
          robot_jid: 'robot_001@xmpp.zoom.us',
          message_id: 'msg_001',
          reply_main_message_id: 'msg_001',
        },
        ...overrides,
      },
    }),
  });
}

// --- Import after mocks ---

let ZoomChannel: typeof import('./zoom.js').ZoomChannel;

beforeEach(async () => {
  vi.resetModules();
  fetchMock.mockReset();
  wsInstances.current = null;
  ({ ZoomChannel } = await import('./zoom.js'));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeOpts(groups: Record<string, { requiresTrigger?: boolean }> = {}) {
  const onMessage = vi.fn();
  const onChatMetadata = vi.fn();
  const registeredGroups = vi.fn(() =>
    Object.fromEntries(
      Object.entries(groups).map(([jid, cfg]) => [
        jid,
        { name: 'test', folder: 'test', trigger: '@Andy', added_at: '', ...cfg },
      ]),
    ),
  );
  return { onMessage, onChatMetadata, registeredGroups };
}

// Task 3.2: channel skips init when credentials missing
describe('registerChannel factory', () => {
  it('returns null when credentials missing', async () => {
    const { registerChannel } = await import('./registry.js');
    const factory = vi.mocked(registerChannel).mock.calls[0]?.[1];
    if (!factory) throw new Error('registerChannel not called');
    const result = factory(makeOpts() as any);
    expect(result).toBeNull();
  });
});

// Task 3.3: handleMessage routes registered JID, drops unregistered
describe('handleMessage', () => {
  it('calls onMessage for registered JID', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    const ws = wsInstances.current!;
    ws.emit('open');
    ws.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).toHaveBeenCalledOnce();
    expect(opts.onMessage.mock.calls[0][0]).toBe('zoom:ch_001');
  });

  it('drops message from unregistered JID', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({}); // no registered groups
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    const ws = wsInstances.current!;
    ws.emit('open');
    ws.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).not.toHaveBeenCalled();
  });
});

// Task 3.4: handleMessage strips @BotName prefix
describe('mention prefix stripping', () => {
  it('strips @BotName and normalizes to @Andy trigger', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    const ws = wsInstances.current!;
    ws.emit('open');
    ws.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));
    const content: string = opts.onMessage.mock.calls[0][1].content;
    expect(content).toMatch(/^@Andy\b/i);
    expect(content).toContain('hello world');
    expect(content).not.toContain('@TestBot');
  });
});

// Task 3.5: handleMessage respects requiresTrigger
describe('requiresTrigger', () => {
  it('forwards message when requiresTrigger false (app_mention always has trigger after normalization)', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).toHaveBeenCalledOnce();
  });

  it('forwards message when requiresTrigger true (normalized content always matches)', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: true } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).toHaveBeenCalledOnce();
  });
});

// Task 3.6: sendMessage splits long message into chunks
describe('sendMessage', () => {
  it('splits long message into chunks', async () => {
    fetchMock
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeSendResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));

    const longText = 'a'.repeat(5000);
    await ch.sendMessage('zoom:ch_001', longText);
    // Two chunks sent (5000 bytes > 4000 limit)
    const sendCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/v2/im/chat/messages'));
    expect(sendCalls.length).toBeGreaterThanOrEqual(2);
  });

  // Task 3.7: sendMessage includes reply_to when last message ID exists
  it('includes reply_to in message body', async () => {
    fetchMock
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeSendResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));

    await ch.sendMessage('zoom:ch_001', 'hello back');
    const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/v2/im/chat/messages'));
    expect(sendCall).toBeDefined();
    const body = JSON.parse(sendCall![1].body as string);
    expect(body.reply_to).toBe('msg_001');
  });
});

// Task 3.8: setTyping(true) posts reaction, stores reactionId
describe('setTyping', () => {
  async function setupWithMessage() {
    fetchMock
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeSendResponse());
    const opts = makeOpts({ 'zoom:ch_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildAppMentionPayload()));
    await new Promise((r) => setTimeout(r, 10));
    return { ch, opts };
  }

  it('posts emoji reaction on setTyping(true)', async () => {
    const { ch } = await setupWithMessage();
    fetchMock.mockResolvedValueOnce(makeReactionResponse('rxn_test'));
    await ch.setTyping('zoom:ch_001', true);
    const reactionCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes('emoji_reactions'),
    );
    expect(reactionCall).toBeDefined();
    expect(reactionCall![1].method).toBe('POST');
  });

  // Task 3.9: setTyping(false) deletes reaction
  it('deletes emoji reaction on setTyping(false)', async () => {
    const { ch } = await setupWithMessage();
    fetchMock.mockResolvedValueOnce(makeReactionResponse('rxn_del'));
    await ch.setTyping('zoom:ch_001', true);
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    await ch.setTyping('zoom:ch_001', false);
    const deleteCalls = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === 'DELETE' && String(c[0]).includes('emoji_reactions'),
    );
    expect(deleteCalls.length).toBe(1);
    expect(String(deleteCalls[0][0])).toContain('rxn_del');
  });

  // Task 3.10: circuit breaker
  it('suppresses typing on 429 and resumes after cooldown', async () => {
    // Setup with real timers first so async setup completes
    const { ch } = await setupWithMessage();

    // Switch to fake timers after async setup is done
    vi.useFakeTimers();

    // First call returns 429 — trips circuit breaker
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429 } as Response);
    await ch.setTyping('zoom:ch_001', true);

    // Second call should be suppressed (no new fetch for emoji reactions)
    const callsBefore = fetchMock.mock.calls.length;
    await ch.setTyping('zoom:ch_001', true);
    expect(fetchMock.mock.calls.length).toBe(callsBefore);

    // Advance past 5-minute backoff
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    // Call setTyping(true) again — backoff expired, should proceed
    fetchMock.mockResolvedValueOnce(makeReactionResponse('rxn_after'));
    await ch.setTyping('zoom:ch_001', true);
    const reactionCalls = fetchMock.mock.calls.filter(
      (c) => c[1]?.method === 'POST' && String(c[0]).includes('emoji_reactions'),
    );
    // Should have two POST emoji_reactions calls: 429 trip and after cooldown
    expect(reactionCalls.length).toBe(2);
  });
});

// --- bot_notification (DM) tests ---

function buildBotNotificationPayload(overrides: Record<string, unknown> = {}) {
  // Format B: top-level event (no module wrapper), flat camelCase payload, cmd = message text
  return JSON.stringify({
    event: 'bot_notification',
    event_ts: 1560796234686,
    payload: {
      accountId: 'acct_001',
      channelName: 'direct',
      cmd: 'hello from DM',
      name: 'TestBot',
      robotJid: 'robot_001@xmpp.zoom.us',
      timestamp: 1560796234686,
      toJid: 'user_dm_001@xmpp.zoom.us',
      userId: 'user_dm_001',
      userJid: 'user_dm_001@xmpp.zoom.us',
      userName: 'DM User',
      ...overrides,
    },
  });
}

// Task 2.1 + 2.3: bot_notification routes to registered DM group with correct JID format
describe('bot_notification handling', () => {
  it('routes to registered DM group as zoom:dm:<userId>', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({ 'zoom:dm:user_dm_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildBotNotificationPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).toHaveBeenCalledOnce();
    expect(opts.onMessage.mock.calls[0][0]).toBe('zoom:dm:user_dm_001');
  });

  // Task 2.2: unregistered DM sender is discarded
  it('discards DM from unregistered userId', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({});
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildBotNotificationPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).not.toHaveBeenCalled();
  });

  // Task 2.4: requiresTrigger is ignored for DM JIDs
  it('forwards DM even when group has requiresTrigger true', async () => {
    fetchMock.mockResolvedValue(makeTokenResponse());
    const opts = makeOpts({ 'zoom:dm:user_dm_001': { requiresTrigger: true } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildBotNotificationPayload()));
    await new Promise((r) => setTimeout(r, 10));
    expect(opts.onMessage).toHaveBeenCalledOnce();
  });

  // Task 2.5: sendMessage to DM JID uses toJid from payload as to_jid
  it('sends reply to payload.toJid for DM', async () => {
    fetchMock
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeSendResponse());
    const opts = makeOpts({ 'zoom:dm:user_dm_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildBotNotificationPayload()));
    await new Promise((r) => setTimeout(r, 10));

    await ch.sendMessage('zoom:dm:user_dm_001', 'hi back');
    const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/v2/im/chat/messages'));
    expect(sendCall).toBeDefined();
    const body = JSON.parse(sendCall![1].body as string);
    expect(body.to_jid).toBe('user_dm_001@xmpp.zoom.us');
  });

  // DM replies should not include reply_to (no threading for DMs)
  it('does not include reply_to in DM reply body', async () => {
    fetchMock
      .mockResolvedValueOnce(makeTokenResponse())
      .mockResolvedValue(makeSendResponse());
    const opts = makeOpts({ 'zoom:dm:user_dm_001': { requiresTrigger: false } });
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', opts as any);
    await ch.connect();
    wsInstances.current!.emit('open');
    wsInstances.current!.emit('message', Buffer.from(buildBotNotificationPayload()));
    await new Promise((r) => setTimeout(r, 10));

    await ch.sendMessage('zoom:dm:user_dm_001', 'response');
    const sendCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/v2/im/chat/messages'));
    const body = JSON.parse(sendCall![1].body as string);
    expect(body.reply_to).toBeUndefined();
  });
});

// ownsJid
describe('ownsJid', () => {
  it('returns true for zoom: prefix', () => {
    const ch = new ZoomChannel('id', 'secret', 'wss://test', 'https://oauth.test', 'https://api.test', makeOpts() as any);
    expect(ch.ownsJid('zoom:ch_001')).toBe(true);
    expect(ch.ownsJid('slack:C001')).toBe(false);
    expect(ch.ownsJid('fs:oc_001')).toBe(false);
  });
});
