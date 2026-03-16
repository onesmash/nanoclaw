## MODIFIED Requirements

### Requirement: Windows Bootstrap Script
A `setup.ps1` file SHALL exist at the project root, providing a Windows equivalent of `setup.sh`. It SHALL verify Node.js >= 20 is available, install NSSM if not already present, install npm dependencies, and invoke `npx tsx setup/index.ts`.

The NSSM install block SHALL be idempotent: if `nssm` is already resolvable on PATH, the block SHALL be skipped. Otherwise `setup.ps1` SHALL install NSSM via `winget install nssm --silent --accept-package-agreements --accept-source-agreements`. If `winget` is not available, `setup.ps1` SHALL print an error directing the user to install NSSM manually and exit with code 1. After a successful winget install, `setup.ps1` SHALL refresh the PATH in the current session so that `nssm` is resolvable before `npx tsx setup/index.ts` is invoked.

#### Scenario: Node.js present and >= 20
- **WHEN** `setup.ps1` is run and Node.js >= 20 is installed
- **THEN** it checks for NSSM, installs npm dependencies, and runs `npx tsx setup/index.ts` without error

#### Scenario: Node.js absent
- **WHEN** `setup.ps1` is run and `node` is not found
- **THEN** it writes an error message directing the user to https://nodejs.org and exits with code 1

#### Scenario: Node.js below version 20
- **WHEN** `setup.ps1` is run and the installed Node.js major version is less than 20
- **THEN** it writes an error message showing the found version and exits with code 1

#### Scenario: NSSM already on PATH
- **WHEN** `setup.ps1` is run and `nssm` is already resolvable via `Get-Command`
- **THEN** the winget install block is skipped and setup continues normally

#### Scenario: NSSM not on PATH, winget available
- **WHEN** `setup.ps1` is run, `nssm` is not on PATH, and `winget` is available
- **THEN** it installs NSSM via winget and refreshes PATH in the current session before proceeding

#### Scenario: NSSM not on PATH, winget unavailable
- **WHEN** `setup.ps1` is run, `nssm` is not on PATH, and `winget` is not available
- **THEN** it prints an error directing the user to install NSSM manually from https://nssm.cc/download and exits with code 1

### Requirement: Windows NSSM Service Registration
The setup service step SHALL register NanoClaw as a Windows service via NSSM when running on `'windows'`, providing auto-start on boot and automatic crash recovery equivalent to launchd on macOS and systemd on Linux.

`setup/service.ts` (`setupWindows`) SHALL NOT install NSSM itself. It SHALL assume NSSM was installed by `setup.ps1` earlier in the bootstrap flow. If `commandExists('nssm')` returns false, `setupWindows` SHALL emit `SETUP_SERVICE` status with `STATUS: 'failed'` and `ERROR: 'nssm_not_found'`, then exit with a non-zero code.

#### Scenario: NSSM on PATH
- **WHEN** `setupWindows()` is called and `nssm` is resolvable on PATH
- **THEN** it proceeds directly to register the service using `nssm` by name

#### Scenario: NSSM not on PATH
- **WHEN** `setupWindows()` is called and `commandExists('nssm')` returns false
- **THEN** it emits `SETUP_SERVICE` status with `SERVICE_TYPE: 'nssm'`, `STATUS: 'failed'`, `ERROR: 'nssm_not_found'`, and a `HINT` pointing to the manual install URL
- **AND** exits the process with a non-zero code
