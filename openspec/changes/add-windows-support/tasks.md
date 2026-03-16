## 1. Platform Detection

- [x] 1.1 Add `'windows'` to the `Platform` union type in `setup/platform.ts`
- [x] 1.2 Add `'nssm'` to the `ServiceManager` union type in `setup/platform.ts`
- [x] 1.3 Add `if (platform === 'win32') return 'windows'` branch in `getPlatform()`
- [x] 1.4 Return `'nssm'` from `getServiceManager()` when platform is `'windows'`
- [x] 1.5 Fix `commandExists()` to use `where.exe <name>` on `win32`, keep `command -v` on Unix
- [x] 1.6 Fix `getNodePath()` to fall back to `where.exe node` on `win32`

## 2. Config Paths

- [x] 2.1 Compute `CONFIG_DIR` in `src/config.ts` using `process.env.APPDATA` on `win32`, `~/.config` on Unix
- [x] 2.2 Derive `SENDER_ALLOWLIST_PATH` from the platform-aware `CONFIG_DIR`

## 3. Signal Handling

- [x] 3.1 Add a `SIGBREAK` handler in `src/index.ts` that calls `shutdown('SIGBREAK')`, guarded by `process.platform === 'win32'`

## 4. Service Setup

- [x] 4.1 Add `setupWindows()` function in `setup/service.ts`
- [x] 4.2 In `setupWindows()`: check for NSSM with `commandExists('nssm')`; if missing, attempt `winget install nssm`; on failure emit `SETUP_SERVICE` status with `ERROR: 'nssm_install_failed'` and exit
- [x] 4.3 In `setupWindows()`: run `nssm install nanoclaw <nodePath>` and configure `AppParameters`, `AppDirectory`, `AppEnvironmentExtra`, `AppStdout`, `AppStderr`, `Start`
- [x] 4.4 In `setupWindows()`: run `nssm start nanoclaw` and emit `SETUP_SERVICE` status with `SERVICE_TYPE: 'nssm'`
- [x] 4.5 Wire `setupWindows()` into the `run()` dispatch in `setup/service.ts` with `else if (platform === 'windows')`

## 5. Bootstrap Script

- [x] 5.1 Create `setup.ps1` at project root
- [x] 5.2 In `setup.ps1`: check Node.js exists and is >= 20, exit with error message if not
- [x] 5.3 In `setup.ps1`: run `npm install` in project root
- [x] 5.4 In `setup.ps1`: invoke `npx tsx setup/index.ts`

## 6. Documentation

- [x] 6.1 Add Windows NSSM service management commands to `CLAUDE.md` (start/stop/restart/status)
