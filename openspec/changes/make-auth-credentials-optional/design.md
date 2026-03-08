# Design: Optional Authentication Credentials

## Context

NanoClaw uses Claude Agent SDK to run AI agents. The SDK supports two authentication methods:
1. Using API key via `ANTHROPIC_API_KEY` environment variable
2. Using logged-in `claude` CLI session (no environment variable needed)

Current implementation enforces credentials in `.env`, but this is unnecessary for personal users who have already logged in via `claude login`.

**Constraints**:
- Secrets cannot be exposed as environment variables to child processes (project convention)
- Must maintain backward compatibility - existing users with API keys are unaffected
- Agent SDK in container needs to access host machine's claude CLI session

**References**:
- [robzolkos/agent-sdk-no-key](https://github.com/robzolkos/agent-sdk-no-key) - Demonstrates SDK working without API key
- Claude Agent SDK documentation - States that when `ANTHROPIC_API_KEY` is absent, it automatically uses claude CLI session

## Goals / Non-Goals

**Goals**:
- Support three authentication methods: API key, Auth token, Claude CLI session
- Smart fallback: Prioritize explicitly configured credentials, fall back to claude CLI session if none
- Clear error messages: If all auth methods unavailable, provide clear action guidance
- Backward compatible: Existing users need no changes

**Non-Goals**:
- No enterprise SSO support (Azure AD, Okta, etc.) - enterprise users should continue using API keys
- No UI or commands for switching auth methods (can be future enhancement)
- No modifications to Agent SDK code inside container

## Decisions

### Decision 1: Authentication Priority Strategy

**Choice**: Explicit config > Claude CLI session > Fail and exit

**Rationale**:
- Explicitly configured credentials have highest priority - matches user expectations
- Claude CLI session as fallback - provides zero-config experience
- If none available, fail immediately - avoids runtime errors

**Alternatives**:
- Option A: Completely remove credential check, rely on SDK error handling
  - Downside: Unfriendly error messages, users don't know how to resolve
- Option B: Keep enforcing credentials, but document that dummy values can be set
  - Downside: Poor UX, violates principle of least surprise

### Decision 2: Startup Check vs Runtime Check

**Choice**: Check authentication status at startup

**Rationale**:
- Fail-fast - avoid discovering auth issues after startup
- Clear feedback to user about which auth method is being used
- Startup check overhead is small (~100ms), acceptable

**Implementation**:
```typescript
// At the start of main() in src/index.ts
const auth = await checkAuthentication();
if (auth.method === 'none') {
  console.error('✗ No authentication credentials found');
  console.error('✗ claude CLI not logged in\n');
  console.error('Please choose an authentication method:');
  console.error('1. Run: claude login');
  console.error('2. Or configure in .env: ANTHROPIC_API_KEY=sk-ant-xxx');
  process.exit(1);
}
console.log(`✓ Using ${auth.method} authentication ${auth.info ? `(${auth.info})` : ''}`);
```

### Decision 3: Credential Passing Method

**Choice**: Keep existing stdin passing approach, but make credentials optional

**Rationale**:
- Follows project convention: secrets not exposed as environment variables
- Minimal change: Only need to modify `readSecrets()` to return empty object instead of erroring
- Agent SDK handles automatically: uses credentials if present, otherwise uses claude CLI session

**Implementation**:
```typescript
// src/process-runner.ts
function readSecrets(): Record<string, string> {
  const secrets = readEnvFile([
    'CLAUDE_CODE_OAUTH_TOKEN',
    'ANTHROPIC_API_KEY',
    'ANTHROPIC_BASE_URL',
    'ANTHROPIC_AUTH_TOKEN',
  ]);
  
  // Only return credentials that actually exist
  return Object.fromEntries(
    Object.entries(secrets).filter(([_, value]) => value !== undefined && value !== '')
  );
}
```

### Decision 4: Claude CLI Session Access

**Choice**: Rely on container inheriting host machine user environment

**Rationale**:
- Current architecture already supports this: child process runs as same user, can access auth info under `~/.config/claude/`
- No additional configuration or mounting needed
- Aligns with project's "remove container isolation" direction

**Validation**: Confirm in testing phase that child process can properly access claude CLI session

## Risks / Trade-offs

### Risk 1: Claude CLI Session Expiration

**Risk**: Startup check passes, but session expires during runtime

**Mitigation**:
- Rely on Agent SDK's error handling - will return clear authentication errors
- User will receive error message, needs to re-run `claude login` and restart NanoClaw
- Future consideration: add session expiration detection and auto-retry

### Risk 2: Container Cannot Access Claude CLI Session

**Risk**: In some environments, child process may not be able to access host machine's claude auth info

**Mitigation**:
- Validate in macOS and Linux environments during testing phase
- If issues discovered, can fall back to requiring API key
- Document that production environments should use API key

### Risk 3: Rate Limits

**Risk**: Claude CLI session uses personal account's rate limits, may not be suitable for high-frequency use

**Mitigation**:
- Clearly state in documentation: personal use recommends claude CLI, production/team use recommends API key
- Add FAQ explaining suitable scenarios for different auth methods

## Migration Plan

**No Migration Needed**: This change is fully backward compatible

**Existing Users**:
- Users with `ANTHROPIC_API_KEY` configured: No changes needed, continue using API key
- Users with `ANTHROPIC_AUTH_TOKEN` configured: No changes needed, continue using auth token

**New Users**:
- Can choose to configure API key or use claude CLI session
- `/setup` skill will guide users to select appropriate auth method

## Open Questions

1. **Should we add `nanoclaw auth status` command?**
   - Can display current auth method and status
   - Not in scope for this change, can be future enhancement

2. **Should we add auth diagnostics to `/debug` skill?**
   - Can help users troubleshoot auth issues
   - Not in scope for this change, can be future enhancement

3. **Should we support runtime auth method switching?**
   - E.g., switch from API key to claude CLI session without restart
   - High complexity, not needed currently
