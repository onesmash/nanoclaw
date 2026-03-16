## 1. setup.ps1
- [x] 1.1 Add idempotent NSSM install block after Node.js version check and before `npm install`: check if `nssm` is on PATH; if not, verify `winget` is available and run `winget install nssm --silent --accept-package-agreements --accept-source-agreements`; exit 1 with a clear message if winget is absent
- [x] 1.2 After the winget call, refresh PATH in the current PowerShell session so subsequent commands can resolve `nssm` by name

## 2. setup/service.ts
- [x] 2.1 Remove the `nssmAbsPath` constant and the entire winget fallback branch from `setupWindows()`
- [x] 2.2 Replace the conditional `nssmCmd` logic with a single `commandExists('nssm')` guard that calls `emitStatus` with `ERROR: 'nssm_not_found'` and exits if NSSM is absent
