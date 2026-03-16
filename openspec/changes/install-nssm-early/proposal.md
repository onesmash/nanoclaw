# Change: Install NSSM in setup.ps1 Before TypeScript Setup

## Why
After winget installs NSSM, the current process's PATH does not refresh, so `setup/service.ts` must hardcode the absolute install path (`C:\Program Files\NSSM\win64\nssm.exe`) to find nssm.exe. Moving NSSM installation to `setup.ps1`—before `npx tsx setup/index.ts` is called—lets the TypeScript service step rely on a fresh PATH and use `nssm` by name with no absolute-path workaround.

## What Changes
- `setup.ps1` gains an idempotent NSSM install block (check PATH first, then winget) that runs before `npm install` and `npx tsx setup/index.ts`
- `setup/service.ts` (`setupWindows`) removes the winget fallback branch and the `nssmAbsPath` constant; it simply checks `commandExists('nssm')` and exits with a clear error if NSSM is absent

## Impact
- Affected specs: `service-setup` (from `add-windows-support`)
- Affected code: `setup.ps1`, `setup/service.ts`
