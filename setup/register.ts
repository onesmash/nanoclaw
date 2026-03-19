/**
 * Step: register — Write channel registration config, create group folders.
 *
 * Accepts --channel to specify the messaging platform (whatsapp, telegram, slack, discord).
 * Uses parameterized SQL queries to prevent injection.
 */
import fs from 'fs';
import path from 'path';

import Database from 'better-sqlite3';

import { STORE_DIR } from '../src/config.js';
import { isValidGroupFolder } from '../src/group-folder.js';
import { logger } from '../src/logger.js';
import { emitStatus } from './status.js';

interface RegisterArgs {
  jid: string;
  name: string;
  trigger: string;
  folder: string;
  channel: string;
  requiresTrigger: boolean;
  isMain: boolean;
  assistantName: string;
}

function parseArgs(args: string[]): RegisterArgs {
  const result: RegisterArgs = {
    jid: '',
    name: '',
    trigger: '',
    folder: '',
    channel: 'whatsapp', // backward-compat: pre-refactor installs omit --channel
    requiresTrigger: true,
    isMain: false,
    assistantName: 'Andy',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--jid':
        result.jid = args[++i] || '';
        break;
      case '--name':
        result.name = args[++i] || '';
        break;
      case '--trigger':
        result.trigger = args[++i] || '';
        break;
      case '--folder':
        result.folder = args[++i] || '';
        break;
      case '--channel':
        result.channel = (args[++i] || '').toLowerCase();
        break;
      case '--no-trigger-required':
        result.requiresTrigger = false;
        break;
      case '--is-main':
        result.isMain = true;
        break;
      case '--assistant-name':
        result.assistantName = args[++i] || 'Andy';
        break;
    }
  }

  return result;
}

export async function run(args: string[]): Promise<void> {
  const projectRoot = process.cwd();
  const parsed = parseArgs(args);

  if (!parsed.jid || !parsed.name || !parsed.trigger || !parsed.folder) {
    emitStatus('REGISTER_CHANNEL', {
      STATUS: 'failed',
      ERROR: 'missing_required_args',
      LOG: 'logs/setup.log',
    });
    process.exit(4);
  }

  if (!isValidGroupFolder(parsed.folder)) {
    emitStatus('REGISTER_CHANNEL', {
      STATUS: 'failed',
      ERROR: 'invalid_folder',
      LOG: 'logs/setup.log',
    });
    process.exit(4);
  }

  logger.info(parsed, 'Registering channel');

  // Ensure data and store directories exist (store/ may not exist on
  // fresh installs that skip WhatsApp auth, which normally creates it)
  fs.mkdirSync(path.join(projectRoot, 'data'), { recursive: true });
  fs.mkdirSync(STORE_DIR, { recursive: true });

  // Write to SQLite using parameterized queries (no SQL injection)
  const dbPath = path.join(STORE_DIR, 'messages.db');
  const timestamp = new Date().toISOString();
  const requiresTriggerInt = parsed.requiresTrigger ? 1 : 0;

  const db = new Database(dbPath);
  // Ensure schema exists
  db.exec(`CREATE TABLE IF NOT EXISTS registered_groups (
    jid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    folder TEXT NOT NULL UNIQUE,
    trigger_pattern TEXT NOT NULL,
    added_at TEXT NOT NULL,
    container_config TEXT,
    requires_trigger INTEGER DEFAULT 1,
    is_main INTEGER DEFAULT 0
  )`);

  const isMainInt = parsed.isMain ? 1 : 0;

  db.prepare(
    `INSERT OR REPLACE INTO registered_groups
     (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger, is_main)
     VALUES (?, ?, ?, ?, ?, NULL, ?, ?)`,
  ).run(
    parsed.jid,
    parsed.name,
    parsed.folder,
    parsed.trigger,
    timestamp,
    requiresTriggerInt,
    isMainInt,
  );

  // Auto-create default heartbeat task for main group (idempotent)
  if (parsed.isMain) {
    db.exec(`CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      group_folder TEXT NOT NULL,
      chat_jid TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      context_mode TEXT DEFAULT 'isolated',
      task_type TEXT DEFAULT 'scheduled',
      next_run TEXT,
      last_run TEXT,
      last_result TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    )`);
    // Add task_type column if missing (existing DBs)
    try {
      db.exec(
        `ALTER TABLE scheduled_tasks ADD COLUMN task_type TEXT DEFAULT 'scheduled'`,
      );
    } catch {
      /* column already exists */
    }

    const existing = db
      .prepare(
        `SELECT id FROM scheduled_tasks WHERE id = 'heartbeat-main' AND status = 'active'`,
      )
      .get();

    if (!existing) {
      const nextRun = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO scheduled_tasks
         (id, group_folder, chat_jid, prompt, schedule_type, schedule_value, context_mode, task_type, next_run, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'heartbeat-main',
        parsed.folder,
        parsed.jid,
        'Read HEARTBEAT.md if it exists. Follow the tasks listed. Do NOT delete, clear, or overwrite this file. Do not infer or repeat old tasks from prior chats. If nothing needs attention, reply exactly: <internal>some message HEARTBEAT_OK</internal>.',
        'interval',
        String(30 * 60 * 1000),
        'group',
        'heartbeat',
        nextRun,
        'active',
        timestamp,
      );
      logger.info('Created default heartbeat task for main group');
    }

    // Auto-create HEARTBEAT.md from template if absent (idempotent)
    const heartbeatPath = path.join(projectRoot, 'groups', parsed.folder, 'HEARTBEAT.md');
    if (!fs.existsSync(heartbeatPath)) {
      const HEARTBEAT_TEMPLATE = `# HEARTBEAT.md

# Keep this file empty (or with only comments) to skip heartbeat API calls.

# Add tasks below when you want the agent to check something periodically.
`;
      fs.writeFileSync(heartbeatPath, HEARTBEAT_TEMPLATE, 'utf8');
      logger.info('Created default HEARTBEAT.md for main group');
    }
  }

  db.close();
  logger.info('Wrote registration to SQLite');

  // Create group folders
  fs.mkdirSync(path.join(projectRoot, 'groups', parsed.folder, 'logs'), {
    recursive: true,
  });

  // Update assistant name in CLAUDE.md files if different from default
  let nameUpdated = false;
  if (parsed.assistantName !== 'Andy') {
    logger.info(
      { from: 'Andy', to: parsed.assistantName },
      'Updating assistant name',
    );

    const mdFiles = [
      path.join(projectRoot, 'groups', 'global', 'CLAUDE.md'),
      path.join(projectRoot, 'groups', parsed.folder, 'CLAUDE.md'),
    ];

    for (const mdFile of mdFiles) {
      if (fs.existsSync(mdFile)) {
        let content = fs.readFileSync(mdFile, 'utf-8');
        content = content.replace(/^# Andy$/m, `# ${parsed.assistantName}`);
        content = content.replace(
          /You are Andy/g,
          `You are ${parsed.assistantName}`,
        );
        fs.writeFileSync(mdFile, content);
        logger.info({ file: mdFile }, 'Updated CLAUDE.md');
      }
    }

    // Update .env
    const envFile = path.join(projectRoot, '.env');
    if (fs.existsSync(envFile)) {
      let envContent = fs.readFileSync(envFile, 'utf-8');
      if (envContent.includes('ASSISTANT_NAME=')) {
        envContent = envContent.replace(
          /^ASSISTANT_NAME=.*$/m,
          `ASSISTANT_NAME="${parsed.assistantName}"`,
        );
      } else {
        envContent += `\nASSISTANT_NAME="${parsed.assistantName}"`;
      }
      fs.writeFileSync(envFile, envContent);
    } else {
      fs.writeFileSync(envFile, `ASSISTANT_NAME="${parsed.assistantName}"\n`);
    }
    logger.info('Set ASSISTANT_NAME in .env');
    nameUpdated = true;
  }

  emitStatus('REGISTER_CHANNEL', {
    JID: parsed.jid,
    NAME: parsed.name,
    FOLDER: parsed.folder,
    CHANNEL: parsed.channel,
    TRIGGER: parsed.trigger,
    REQUIRES_TRIGGER: parsed.requiresTrigger,
    ASSISTANT_NAME: parsed.assistantName,
    NAME_UPDATED: nameUpdated,
    STATUS: 'success',
    LOG: 'logs/setup.log',
  });
}
