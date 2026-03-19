import { exec } from 'child_process';
import { promisify } from 'util';

import { readEnvFile } from './env.js';

const execAsync = promisify(exec);

export interface ClaudeAuthStatus {
  loggedIn: boolean;
  email?: string;
  orgName?: string;
  subscriptionType?: string | null;
}

export interface AuthenticationResult {
  method: 'api_key' | 'auth_token' | 'claude_cli' | 'none';
  info?: string;
}

/**
 * Check if claude CLI is installed and logged in
 */
export async function checkClaudeAuth(): Promise<ClaudeAuthStatus> {
  try {
    const result = await execAsync('claude auth status');
    const status = JSON.parse(result.stdout);
    return {
      loggedIn: status.loggedIn === true,
      email: status.email,
      orgName: status.orgName,
      subscriptionType: status.subscriptionType,
    };
  } catch (error) {
    // claude CLI not installed or not logged in
    return { loggedIn: false };
  }
}

/**
 * Check available authentication methods in priority order:
 * 1. ANTHROPIC_API_KEY (if set)
 * 2. ANTHROPIC_AUTH_TOKEN (if set)
 * 3. Claude CLI session (if logged in)
 * 4. None (will fail)
 */
export async function checkAuthentication(): Promise<AuthenticationResult> {
  const env = readEnvFile(['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']);

  if (env.ANTHROPIC_API_KEY) {
    return { method: 'api_key', info: 'ANTHROPIC_API_KEY' };
  }

  if (env.ANTHROPIC_AUTH_TOKEN) {
    return { method: 'auth_token', info: 'ANTHROPIC_AUTH_TOKEN' };
  }

  const claudeAuth = await checkClaudeAuth();
  if (claudeAuth.loggedIn) {
    const info = claudeAuth.email
      ? `${claudeAuth.email}${claudeAuth.orgName ? ` (${claudeAuth.orgName})` : ''}`
      : undefined;
    return {
      method: 'claude_cli',
      info,
    };
  }

  return { method: 'none' };
}

/**
 * Check if Cursor agent CLI is installed and available.
 * Used when AGENT_BACKEND=cursor — Cursor mode uses agent CLI, not Claude.
 */
export async function checkCursorCli(): Promise<boolean> {
  try {
    await execAsync('agent --version');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if codex-acp is directly available on PATH.
 * The runtime can still fall back to npx, so this is informational only.
 */
export async function checkCodexAcpCli(): Promise<boolean> {
  try {
    await execAsync('codex-acp --version');
    return true;
  } catch {
    return false;
  }
}
