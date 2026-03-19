import { describe, expect, it } from 'vitest';

import {
  buildCodexMcpServers,
  resolveCodexAcpLaunchSpec,
} from '../container/agent-runner/src/codex-runner.js';

describe('codex-runner helpers', () => {
  it('prefers explicit command override', () => {
    const spec = resolveCodexAcpLaunchSpec({
      CODEX_ACP_COMMAND: '/tmp/custom-codex-acp',
    } as NodeJS.ProcessEnv);

    expect(spec).toEqual({
      command: '/tmp/custom-codex-acp',
      args: [],
      source: 'override',
    });
  });

  it('uses npx when explicitly requested', () => {
    const spec = resolveCodexAcpLaunchSpec({
      CODEX_ACP_USE_NPX: 'true',
    } as NodeJS.ProcessEnv);

    expect(spec.source).toBe('npx');
    expect(spec.args).toEqual(['@zed-industries/codex-acp']);
  });

  it('builds stdio MCP config for nanoclaw', () => {
    const servers = buildCodexMcpServers({
      input: {
        prompt: 'hello',
        groupFolder: 'demo-group',
        chatJid: 'demo@g.us',
        isMain: false,
      },
      groupDir: '/tmp/demo-group',
      projectRoot: '/tmp/project',
      ipcDir: '/tmp/ipc',
      systemContext: { extraDirs: [] },
      initialPrompt: 'hello',
    });

    expect(servers).toHaveLength(1);
    expect(servers[0]).toMatchObject({
      name: 'nanoclaw',
      command: process.execPath,
      args: [expect.stringContaining('ipc-mcp-stdio.js')],
    });
    expect(servers[0].env).toEqual(
      expect.arrayContaining([
        { name: 'NANOCLAW_CHAT_JID', value: 'demo@g.us' },
        { name: 'NANOCLAW_GROUP_FOLDER', value: 'demo-group' },
        { name: 'NANOCLAW_IS_MAIN', value: '0' },
      ]),
    );
  });
});
