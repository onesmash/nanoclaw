# Change: Add Windows Support via NSSM Service

## Why

NanoClaw already runs on macOS and Linux. Since the agent runtime was migrated from containers to direct Node.js subprocess spawning, the core code is already cross-platform. The remaining gap is Windows service management, platform detection, config path conventions, and a bootstrap script — a small and well-scoped addition.

## What Changes

- Add `'windows'` to the `Platform` type and `'nssm'` to `ServiceManager` type in `setup/platform.ts`
- Fix `commandExists()` and `getNodePath()` to use `where.exe` on Windows instead of `command -v`
- Add `setupWindows()` in `setup/service.ts` that installs and starts NSSM, registers `nanoclaw` as an auto-start service, and emits `SETUP_SERVICE` status
- Fix `SENDER_ALLOWLIST_PATH` in `src/config.ts` to use `%APPDATA%\nanoclaw` on Windows instead of `~/.config/nanoclaw`
- Add `SIGBREAK` handler in `src/index.ts` for Windows service shutdown signal
- Add `setup.ps1` bootstrap script at the project root, equivalent to `setup.sh`, for Windows users

## Impact

- Affected specs: `platform-detection`, `service-setup`, `signal-handling`, `config-paths`
- Affected code: `setup/platform.ts`, `setup/service.ts`, `src/index.ts`, `src/config.ts`, new `setup.ps1`
- No breaking changes to existing macOS/Linux behavior
