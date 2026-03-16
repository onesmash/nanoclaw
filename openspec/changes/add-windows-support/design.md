## Context

NanoClaw's agent runner was migrated from container-based execution (Apple Container/Docker) to direct Node.js subprocess spawning. That migration removed the primary blocker for Windows support — the container runtime. The remaining gaps are shallow:

1. Platform/service-manager detection hardcodes macOS and Linux
2. Config paths use Unix conventions (`~/.config/nanoclaw`)
3. `commandExists()` and `getNodePath()` use shell built-ins unavailable on Windows
4. No Windows service manager integration
5. No Windows bootstrap script
6. Missing `SIGBREAK` signal handler (Windows service stop signal)

Stakeholders: solo operator running NanoClaw on a Windows 10/11 machine as a background service.

## Goals / Non-Goals

- Goals:
  - Register NanoClaw as a Windows service via NSSM with auto-start and crash recovery, on par with launchd/systemd
  - Provide `setup.ps1` as the Windows equivalent of `setup.sh`
  - Correct all platform-specific assumptions so existing tests and macOS/Linux behavior are unaffected
- Non-Goals:
  - WSL2 support (out of scope; native Windows process approach is sufficient)
  - Windows ARM architecture (Node.js supports it but it is untested and not validated)
  - GUI installer or tray icon

## Decisions

- **NSSM as service manager**: NSSM is the established, free tool for wrapping Node.js (or any process) as a Windows service. It handles stdout/stderr redirection, `Start SERVICE_AUTO_START`, and restart on crash without requiring a custom service wrapper. Alternative: `node-windows` npm package — rejected because it adds a runtime dependency and is less well-known to Windows administrators.

- **winget for NSSM auto-install**: `winget` ships with Windows 10 1709+ and Windows 11. If winget is unavailable (rare), setup fails fast with a clear manual-install hint. Alternative: download NSSM binary directly — rejected to avoid embedding a download URL that may change and to keep the bootstrap script simple.

- **`%APPDATA%` for config dir**: `%APPDATA%` (`C:\Users\<user>\AppData\Roaming`) is the Windows convention for per-user application config, equivalent to `~/.config` on Linux. Using `os.homedir()` would work but violates Windows conventions and may conflict with other tools.

- **`where.exe` for command detection**: `where.exe` is a built-in Windows executable available since Windows Server 2003 / Vista. `command -v` is a shell built-in that does not exist in Node.js `execSync` context on Windows. No third-party dependency needed.

- **`SIGBREAK` guard**: The handler is registered only when `process.platform === 'win32'` to avoid issues on platforms where `SIGBREAK` is not defined. On Windows, both `SIGTERM` and `SIGKILL` map to `TerminateProcess()`; `SIGBREAK` is the signal that Windows services send for graceful stop.

## Risks / Trade-offs

- **winget not available**: Older Windows 10 versions may lack `winget`. Mitigation: fail fast with a clear error message and a manual NSSM download URL.
- **NSSM PATH after winget install**: `winget` installs NSSM to `C:\Program Files\NSSM\win64\nssm.exe` but does not immediately update the current process's `PATH`. Mitigation: `setupWindows()` should use the absolute path after installation when calling `nssm` for the first time.
- **PowerShell execution policy**: `setup.ps1` requires PowerShell execution policy to allow local script execution. Mitigation: document that the user may need `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`.

## Migration Plan

No migration required for existing macOS/Linux installs. Changes to `platform.ts`, `service.ts`, `config.ts`, and `index.ts` are additive (new code paths guarded by `process.platform === 'win32'`).

## Open Questions

- Should `setup.ps1` automatically set `Set-ExecutionPolicy` or just document it?
- Should the CLAUDE.md service management section be broken out into a separate capability spec, or kept inline?
