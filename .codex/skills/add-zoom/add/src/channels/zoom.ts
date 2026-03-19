import WebSocket from 'ws';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

const MAX_MESSAGE_BYTES = 4000;
const PING_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = PING_INTERVAL_MS * 2;
const RECONNECT_DELAY_MS = 5_000;
const RECONNECT_DELAY_FAILURE_MS = 30_000;
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

interface ZoomMessageContext {
  toJid: string;
  userJid: string;
  accountId: string;
  robotJid: string;
  replyTo: string | undefined;
}

export interface ZoomChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

function splitMessage(text: string): string[] {
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = '';
  for (const char of text) {
    const next = current + char;
    if (encoder.encode(next).length > MAX_MESSAGE_BYTES) {
      chunks.push(current);
      current = char;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function stripMentionPrefix(message: string, robotName: string): string {
  const content = message.trim();
  if (!content.startsWith('@')) return content;
  const prefix = `@${robotName.trim()}`;
  if (content === prefix) return '';
  if (content.startsWith(prefix + ' ')) return content.slice(prefix.length).trim();
  // Generic: strip any @word prefix
  const parts = content.split(/\s+/);
  return parts.length > 1 ? content.slice(parts[0].length).trim() : '';
}

function toStr(obj: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v) return v;
  }
  return undefined;
}

export class ZoomChannel implements Channel {
  name = 'zoom';

  private ws: WebSocket | null = null;
  private accessToken: string | null = null;
  private tokenExpiresAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private nextReconnectDelay = RECONNECT_DELAY_MS;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastServerMsgAt = 0;
  private lastContextByJid: Record<string, ZoomMessageContext> = {};
  private lastMessageIdByJid: Record<string, string> = {};
  private lastReactionByJid: Record<string, { messageId: string; reactionId: string }> = {};
  private typingBackoffUntil = 0;
  private readonly TYPING_BACKOFF_MS = 5 * 60 * 1000;

  private clientId: string;
  private clientSecret: string;
  private wsUrl: string;
  private oauthBaseUrl: string;
  private apiBaseUrl: string;
  private opts: ZoomChannelOpts;

  constructor(
    clientId: string,
    clientSecret: string,
    wsUrl: string,
    oauthBaseUrl: string,
    apiBaseUrl: string,
    opts: ZoomChannelOpts,
  ) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.wsUrl = wsUrl;
    this.oauthBaseUrl = oauthBaseUrl;
    this.apiBaseUrl = apiBaseUrl;
    this.opts = opts;
  }

  private async fetchToken(): Promise<void> {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const url = `${this.oauthBaseUrl.replace(/\/$/, '')}/oauth/token?grant_type=client_credentials`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      throw new Error(`Zoom OAuth failed: ${res.status}`);
    }
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - TOKEN_EXPIRY_BUFFER_MS;
    logger.info('Zoom access token fetched');
  }

  private async ensureToken(): Promise<string> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.fetchToken();
    }
    return this.accessToken!;
  }

  async connect(): Promise<void> {
    try {
      await this.fetchToken();
    } catch (err) {
      logger.error({ err }, 'Zoom: failed to fetch initial token, retrying');
      this.scheduleReconnect();
      return;
    }

    const ws = new WebSocket(this.wsUrl, {
      headers: { access_token: this.accessToken! },
    });
    this.ws = ws;

    ws.on('open', () => {
      logger.info('Zoom WebSocket connected');
      console.log(`\n  Zoom bot connected (WebSocket mode)\n`);
      this.lastServerMsgAt = Date.now();
      this.startPing(ws);
    });

    ws.on('message', (data: WebSocket.RawData) => {
      this.lastServerMsgAt = Date.now();
      void this.handleMessage(data.toString());
    });

    ws.on('pong', () => {
      // heartbeat acknowledged
    });

    ws.on('close', (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, 'Zoom WebSocket closed');
      const delay = this.nextReconnectDelay;
      this.nextReconnectDelay = RECONNECT_DELAY_MS;
      this.clearTimers();
      this.scheduleReconnect(delay);
    });

    ws.on('error', (err) => {
      logger.error({ err }, 'Zoom WebSocket error');
    });
  }

  private startPing(ws: WebSocket): void {
    this.clearTimers();
    // Send application-level heartbeat immediately, then every PING_INTERVAL_MS
    const sendHeartbeat = () => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (this.lastServerMsgAt > 0 && Date.now() - this.lastServerMsgAt > HEARTBEAT_TIMEOUT_MS) {
        logger.warn('Zoom: heartbeat timeout, terminating stale connection');
        ws.terminate();
        return;
      }
      ws.send(JSON.stringify({ module: 'heartbeat' }));
    };
    sendHeartbeat();
    this.pingTimer = setInterval(sendHeartbeat, PING_INTERVAL_MS);
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(delay = RECONNECT_DELAY_MS): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }

  private async handleMessage(raw: string): Promise<void> {
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }

    if (typeof data !== 'object' || data === null) return;
    const dataObj = data as Record<string, unknown>;

    // build_connection: connection established
    if (dataObj.module === 'build_connection') {
      logger.info({ success: dataObj.success }, 'Zoom build_connection');
      if (dataObj.success === false) {
        this.nextReconnectDelay = RECONNECT_DELAY_FAILURE_MS;
        this.ws?.close();
      }
      return;
    }

    // Server heartbeat response — lastServerMsgAt already updated, no echo needed
    if (dataObj.module === 'heartbeat') {
      return;
    }

    const topEvent = dataObj.event as string | undefined;

    // Format A: {"module":"message","content":{"event":"team_chat.app_mention"|"bot_notification","payload":{...}}}
    // Format B: {"event":"team_chat.app_mention","payload":{...}} at top level
    // Format C: {"event":"bot_notification","payload":{...}} at top level (DM)
    let contentObj: Record<string, unknown> | null = null;
    let payload: Record<string, unknown> | undefined;

    if (dataObj.module === 'message') {
      let content: unknown = dataObj.content;
      if (typeof content === 'string') {
        try {
          content = JSON.parse(content);
        } catch {
          return;
        }
      }
      if (typeof content === 'object' && content !== null) {
        contentObj = content as Record<string, unknown>;
        if (
          contentObj.event !== 'team_chat.app_mention' &&
          contentObj.event !== 'bot_notification'
        ) {
          logger.info({ event: contentObj.event }, 'Zoom message event ignored');
          return;
        }
        payload = contentObj.payload as Record<string, unknown> | undefined;
      }
    } else if (topEvent === 'team_chat.app_mention') {
      logger.info('Zoom app_mention received (top-level event format)');
      payload = dataObj.payload as Record<string, unknown> | undefined;
      contentObj = {};
    } else if (topEvent === 'bot_notification') {
      logger.info('Zoom bot_notification received (DM)');
      payload = dataObj.payload as Record<string, unknown> | undefined;
      contentObj = { event: 'bot_notification' };
    }

    if (!payload) return;

    const isDM = topEvent === 'bot_notification' || contentObj?.event === 'bot_notification';

    if (isDM) {
      const userId = toStr(payload, 'userId');
      if (!userId) return;

      const jid = `zoom:dm:${userId}`;
      const timestamp = new Date().toISOString();
      this.opts.onChatMetadata(jid, timestamp, userId, 'zoom', false);

      const group = this.opts.registeredGroups()[jid];
      if (!group) {
        logger.info({ jid, userId }, 'Zoom DM from unregistered user (register with registerGroup to enable)');
        return;
      }

      const robotJid = toStr(payload, 'robotJid');
      const toJid = toStr(payload, 'toJid');
      const userJid = toStr(payload, 'userJid');
      const accountId = toStr(payload, 'accountId');
      const messageId = Date.now().toString();

      if (robotJid && toJid && accountId && userJid) {
        this.lastContextByJid[jid] = { toJid, userJid, accountId, robotJid, replyTo: undefined };
        this.lastMessageIdByJid[jid] = messageId;
      }

      // DMs always bypass requiresTrigger
      let dmContent = (payload.cmd as string) ?? '';
      if (!TRIGGER_PATTERN.test(dmContent)) {
        dmContent = `@${ASSISTANT_NAME} ${dmContent}`.trim();
      }

      this.opts.onMessage(jid, {
        id: messageId,
        chat_jid: jid,
        sender: userId,
        sender_name: toStr(payload, 'userName') ?? userId,
        content: dmContent,
        timestamp,
        is_from_me: false,
      });

      logger.info({ jid, userId }, 'Zoom DM stored');
      return;
    }

    // app_mention path (channel messages)
    const obj = payload.object as Record<string, unknown> | undefined;
    if (!obj) return;

    const channelId = toStr(obj, 'channel_id', 'channelId');
    if (!channelId) {
      logger.info({ objKeys: Object.keys(obj) }, 'Zoom app_mention event missing channel_id');
      return;
    }

    const jid = `zoom:${channelId}`;
    const timestamp = new Date().toISOString();
    this.opts.onChatMetadata(jid, timestamp, channelId, 'zoom', true);

    const group = this.opts.registeredGroups()[jid];
    if (!group) {
      logger.info({ jid, channelId }, 'Zoom message from unregistered channel (register with registerGroup to enable)');
      return;
    }

    const rawMessage = (obj.message as string) ?? '';
    const robotName = toStr(obj, 'robot_name', 'robotName');
    const messageId = toStr(obj, 'message_id', 'messageId', 'id');
    const replyTo =
      toStr(obj, 'reply_main_message_id', 'replyMainMessageId') ?? messageId;
    const robotJid =
      toStr(obj, 'robot_jid', 'robotJid') ?? toStr(payload, 'robot_jid', 'robotJid');
    const accountId = toStr(payload, 'account_id', 'accountId');
    const operatorId = toStr(payload, 'operator_id', 'operatorId');
    const operatorJid = toStr(payload, 'operator_jid', 'operatorJid');

    // Build to_jid for the channel (dev uses xmppdev.zoom.us)
    let toJid = toStr(obj, 'to_jid', 'toJid');
    if (!toJid && channelId) {
      const xmppHost = this.apiBaseUrl.includes('zoomdev') ? 'conference.xmppdev.zoom.us' : 'conference.xmpp.zoom.us';
      toJid = `${channelId}@${xmppHost}`;
    }

    // Build user_jid: prefer operator_jid, fallback to derived
    const userJid = operatorJid ?? (operatorId ? `${operatorId.toLowerCase()}@xmpp.zoom.us` : undefined);

    if (robotJid && toJid && accountId && userJid && replyTo && messageId) {
      this.lastContextByJid[jid] = { toJid, userJid, accountId, robotJid, replyTo };
      this.lastMessageIdByJid[jid] = messageId;
    }

    // Strip @BotName prefix (always present in app_mention events)
    let msgContent = rawMessage;
    if (robotName) {
      msgContent = stripMentionPrefix(rawMessage, robotName);
    }

    // Normalize to trigger format for the agent pipeline
    if (!TRIGGER_PATTERN.test(msgContent)) {
      msgContent = `@${ASSISTANT_NAME} ${msgContent}`.trim();
    }

    if (group.requiresTrigger && !TRIGGER_PATTERN.test(msgContent)) {
      logger.debug({ jid }, 'Zoom message ignored (no trigger)');
      return;
    }

    this.opts.onMessage(jid, {
      id: messageId ?? Date.now().toString(),
      chat_jid: jid,
      sender: operatorId ?? '',
      sender_name: operatorId ?? '',
      content: msgContent,
      timestamp,
      is_from_me: false,
    });

    logger.info({ jid, channelId, operatorId }, 'Zoom message stored');
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    const ctx = this.lastContextByJid[jid];
    if (!ctx) {
      logger.warn({ jid }, 'Zoom: no message context for JID, cannot reply');
      return;
    }
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      await this.postMessage(ctx, chunk);
    }
  }

  private async postMessage(ctx: ZoomMessageContext, text: string, retry = false): Promise<void> {
    let token: string;
    try {
      token = await this.ensureToken();
    } catch (err) {
      logger.error({ err }, 'Zoom: failed to get token for sending');
      return;
    }

    const url = `${this.apiBaseUrl.replace(/\/$/, '')}/v2/im/chat/messages`;
    const body: Record<string, unknown> = {
      robot_jid: ctx.robotJid,
      to_jid: ctx.toJid,
      account_id: ctx.accountId,
      user_jid: ctx.userJid,
      content: { body: [{ type: 'message', text }] },
    };
    if (ctx.replyTo) body.reply_to = ctx.replyTo;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (err) {
      logger.error({ err }, 'Zoom: network error sending message');
      return;
    }

    if (res.status === 401 && !retry) {
      try {
        await this.fetchToken();
      } catch (err) {
        logger.error({ err }, 'Zoom: token refresh failed on 401');
        return;
      }
      return this.postMessage(ctx, text, true);
    }

    if (!res.ok) {
      logger.error({ status: res.status, toJid: ctx.toJid }, 'Zoom: failed to send message');
      return;
    }

    logger.info({ toJid: ctx.toJid }, 'Zoom message sent');
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('zoom:');
  }

  async disconnect(): Promise<void> {
    this.clearTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info('Zoom bot stopped');
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    if (Date.now() < this.typingBackoffUntil) return;

    const messageId = this.lastMessageIdByJid[jid];
    if (!messageId) return;

    let token: string;
    try {
      token = await this.ensureToken();
    } catch {
      return;
    }

    const baseUrl = `${this.apiBaseUrl.replace(/\/$/, '')}/v2/im/chat/messages/${messageId}/emoji_reactions`;

    if (isTyping) {
      try {
        const res = await fetch(baseUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ emoji: 'hourglass' }),
        });
        if (res.status === 429) {
          this.typingBackoffUntil = Date.now() + this.TYPING_BACKOFF_MS;
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { reaction_id?: string };
          if (data.reaction_id) {
            this.lastReactionByJid[jid] = { messageId, reactionId: data.reaction_id };
          }
        }
      } catch (err) {
        logger.debug({ jid, err }, 'Zoom: failed to add typing reaction');
      }
    } else {
      const reaction = this.lastReactionByJid[jid];
      delete this.lastReactionByJid[jid];
      delete this.lastMessageIdByJid[jid];
      if (reaction) {
        const deleteUrl = `${this.apiBaseUrl.replace(/\/$/, '')}/v2/im/chat/messages/${reaction.messageId}/emoji_reactions/${reaction.reactionId}`;
        try {
          const res = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.status === 429) {
            this.typingBackoffUntil = Date.now() + this.TYPING_BACKOFF_MS;
          }
        } catch (err) {
          logger.debug({ jid, err }, 'Zoom: failed to remove typing reaction');
        }
      }
    }
  }
}

registerChannel('zoom', (opts: ChannelOpts) => {
  const envVars = readEnvFile([
    'ZOOM_CLIENT_ID',
    'ZOOM_CLIENT_SECRET',
    'ZOOM_WEBSOCKET_URL',
    'ZOOM_OAUTH_BASE_URL',
    'ZOOM_API_BASE_URL',
  ]);
  const clientId = process.env.ZOOM_CLIENT_ID || envVars.ZOOM_CLIENT_ID || '';
  const clientSecret = process.env.ZOOM_CLIENT_SECRET || envVars.ZOOM_CLIENT_SECRET || '';
  const wsUrl = process.env.ZOOM_WEBSOCKET_URL || envVars.ZOOM_WEBSOCKET_URL || '';
  const oauthBaseUrl = process.env.ZOOM_OAUTH_BASE_URL || envVars.ZOOM_OAUTH_BASE_URL || '';
  const apiBaseUrl = process.env.ZOOM_API_BASE_URL || envVars.ZOOM_API_BASE_URL || '';

  if (!clientId || !clientSecret || !wsUrl || !oauthBaseUrl || !apiBaseUrl) {
    logger.warn(
      'Zoom: missing credentials (ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_WEBSOCKET_URL, ZOOM_OAUTH_BASE_URL, ZOOM_API_BASE_URL)',
    );
    return null;
  }

  return new ZoomChannel(clientId, clientSecret, wsUrl, oauthBaseUrl, apiBaseUrl, opts);
});
