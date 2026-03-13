import fs from 'fs';
import path from 'path';

export interface ContainerInput {
  prompt: string;
  sessionId?: string;
  groupFolder: string;
  chatJid: string;
  isMain: boolean;
  isScheduledTask?: boolean;
  assistantName?: string;
  secrets?: Record<string, string>;
}

export interface ContainerOutput {
  status: 'success' | 'error';
  result: string | null;
  newSessionId?: string;
  error?: string;
}

export const OUTPUT_START_MARKER = '---NANOCLAW_OUTPUT_START---';
export const OUTPUT_END_MARKER = '---NANOCLAW_OUTPUT_END---';

export function writeOutput(output: ContainerOutput): void {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

export async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', chunk => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

export const IPC_POLL_MS = 500;

export function shouldClose(ipcInputCloseSentinel: string): boolean {
  if (fs.existsSync(ipcInputCloseSentinel)) {
    try { fs.unlinkSync(ipcInputCloseSentinel); } catch { /* ignore */ }
    return true;
  }
  return false;
}

export function drainIpcInput(ipcInputDir: string): string[] {
  try {
    fs.mkdirSync(ipcInputDir, { recursive: true });
    const files = fs.readdirSync(ipcInputDir)
      .filter(f => f.endsWith('.json'))
      .sort();

    const messages: string[] = [];
    for (const file of files) {
      const filePath = path.join(ipcInputDir, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        fs.unlinkSync(filePath);
        if (data.type === 'message' && data.text) {
          messages.push(data.text);
        }
      } catch {
        try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      }
    }
    return messages;
  } catch {
    return [];
  }
}

export function waitForIpcMessage(
  ipcInputDir: string,
  ipcInputCloseSentinel: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const poll = () => {
      if (shouldClose(ipcInputCloseSentinel)) {
        resolve(null);
        return;
      }
      const messages = drainIpcInput(ipcInputDir);
      if (messages.length > 0) {
        resolve(messages.join('\n'));
        return;
      }
      setTimeout(poll, IPC_POLL_MS);
    };
    poll();
  });
}

export interface SystemContext {
  soulContent?: string;
  identityContent?: string;
  userContent?: string;
  globalClaudeMd?: string;
  bootstrapContent?: string;
  toolsContent?: string;
  heartbeatContent?: string;
  memoryContent?: string;
  extraDirs: string[];
}

export function loadSystemContext(containerInput: ContainerInput): SystemContext {
  const globalClaudeMdPath = path.join(process.env.NANOCLAW_GLOBAL_DIR ?? '', 'CLAUDE.md');
  const identityPath = process.env.NANOCLAW_IDENTITY_PATH;
  const soulPath = process.env.NANOCLAW_SOUL_PATH;
  const userPath = process.env.NANOCLAW_USER_PATH;
  const heartbeatPath = process.env.NANOCLAW_HEARTBEAT_PATH;
  const memoryPath = process.env.NANOCLAW_MEMORY_PATH;
  const bootstrapPath = path.join(process.env.NANOCLAW_GROUP_DIR ?? '', 'BOOTSTRAP.md');
  const toolsPath = path.join(process.env.NANOCLAW_GROUP_DIR ?? '', 'TOOLS.md');

  const readIfExists = (p: string | undefined) =>
    p && fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : undefined;

  const soulContent = readIfExists(soulPath);
  const identityContent = readIfExists(identityPath);
  const userContent = readIfExists(userPath);
  const heartbeatContent = readIfExists(heartbeatPath);
  const memoryContent = readIfExists(memoryPath);

  const globalClaudeMd =
    !containerInput.isMain && fs.existsSync(globalClaudeMdPath)
      ? fs.readFileSync(globalClaudeMdPath, 'utf-8')
      : undefined;

  const bootstrapContent = readIfExists(bootstrapPath);
  const toolsContent = readIfExists(toolsPath);

  const extraDirs: string[] = [];
  const extraBase = process.env.NANOCLAW_EXTRA_DIR;
  if (extraBase && fs.existsSync(extraBase)) {
    for (const entry of fs.readdirSync(extraBase)) {
      const fullPath = path.join(extraBase, entry);
      if (fs.statSync(fullPath).isDirectory()) {
        extraDirs.push(fullPath);
      }
    }
  }

  return { soulContent, identityContent, userContent, globalClaudeMd, bootstrapContent, toolsContent, heartbeatContent, memoryContent, extraDirs };
}

export function buildSystemPromptAppend(ctx: SystemContext): string | undefined {
  const parts = [
    ctx.globalClaudeMd,
    ctx.toolsContent,
    ctx.soulContent,
    ctx.identityContent,
    ctx.userContent,
    ctx.heartbeatContent,
    ctx.bootstrapContent,
    ctx.memoryContent,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}

export function applyScheduledTaskPrefix(prompt: string, isScheduledTask?: boolean): string {
  if (!isScheduledTask) return prompt;
  return `[SCHEDULED TASK - The following message was sent automatically and is not coming directly from the user or group.]\n\n${prompt}`;
}
