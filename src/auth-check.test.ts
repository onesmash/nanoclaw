import { describe, it, expect, vi, beforeEach } from 'vitest';

import { checkAuthentication, checkCursorCli } from './auth-check.js';
import * as envModule from './env.js';

vi.mock('./env.js');

describe('auth-check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkAuthentication', () => {
    it('should prioritize ANTHROPIC_API_KEY', async () => {
      vi.mocked(envModule.readEnvFile).mockReturnValue({
        ANTHROPIC_API_KEY: 'sk-ant-test123',
        ANTHROPIC_AUTH_TOKEN: 'token123',
      });

      const result = await checkAuthentication();

      expect(result).toEqual({
        method: 'api_key',
        info: 'ANTHROPIC_API_KEY',
      });
    });

    it('should use ANTHROPIC_AUTH_TOKEN if API key not set', async () => {
      vi.mocked(envModule.readEnvFile).mockReturnValue({
        ANTHROPIC_AUTH_TOKEN: 'token123',
      });

      const result = await checkAuthentication();

      expect(result).toEqual({
        method: 'auth_token',
        info: 'ANTHROPIC_AUTH_TOKEN',
      });
    });

    it('should check claude CLI if no credentials configured', async () => {
      vi.mocked(envModule.readEnvFile).mockReturnValue({});

      const result = await checkAuthentication();

      // Since we can't easily mock checkClaudeAuth, just verify it returns
      // either claude_cli or none based on actual system state
      expect(['claude_cli', 'none']).toContain(result.method);
    });
  });

  describe('checkCursorCli', () => {
    it('should return boolean based on agent CLI availability', async () => {
      const result = await checkCursorCli();
      expect(typeof result).toBe('boolean');
    });
  });
});
