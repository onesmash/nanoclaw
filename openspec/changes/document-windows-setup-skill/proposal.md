# Change: Document Windows Setup in SKILL.md

## Why

The `add-windows-support` change added `setup.ps1` and NSSM-based service management for Windows users, but `.claude/skills/setup/SKILL.md` still only documents the macOS/Linux flow. Windows users following the skill will run `bash setup.sh`, install nssm via launchd/systemd — none of which applies to them. The skill needs a Windows section so the AI assistant can guide Windows users correctly.

## What Changes

- Add a Windows prerequisites note (Windows 10/11, Node.js >= 20, PowerShell 5.1+, `Set-ExecutionPolicy` hint)
- Update Step 1 Bootstrap to branch on OS: run `.\setup.ps1` on Windows instead of `bash setup.sh`
- Document what `setup.ps1` does: checks Node.js version, installs NSSM via winget, runs `npm install`, then `npx tsx setup/index.ts`
- Update Step 8 Start Service to include Windows service management: `nssm start/stop/restart/status nanoclaw`
- Update Step 9 Verify and Troubleshooting to include Windows restart commands
- Keep existing macOS and Linux sections intact — no breaking changes for existing platforms

## Impact

- Affected specs: `setup-skill` (new capability delta)
- Affected code: `.claude/skills/setup/SKILL.md`
- No breaking changes to existing macOS/Linux behavior or any runtime code
