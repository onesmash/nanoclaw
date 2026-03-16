## 1. Update SKILL.md

- [x] 1.1 Add Windows prerequisites section near the top of SKILL.md (Windows 10/11, Node.js >= 20, PowerShell 5.1+, Set-ExecutionPolicy hint)
- [x] 1.2 Update Step 1 Bootstrap to branch on OS: run `.\setup.ps1` on Windows, `bash setup.sh` on macOS/Linux
- [x] 1.3 Document what setup.ps1 does (Node.js check, NSSM via winget, npm install, npx tsx setup/index.ts)
- [x] 1.4 Update Step 8 Start Service to include Windows NSSM commands (nssm start/stop/restart/status nanoclaw)
- [x] 1.5 Update Step 9 Verify fix commands to include Windows NSSM restart equivalent
- [x] 1.6 Update Troubleshooting section to include Windows service unload/restart command via nssm
