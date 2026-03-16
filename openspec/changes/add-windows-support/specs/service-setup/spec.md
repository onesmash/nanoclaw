## ADDED Requirements

### Requirement: Windows NSSM Service Registration
The setup service step SHALL register NanoClaw as a Windows service via NSSM when running on `'windows'`, providing auto-start on boot and automatic crash recovery equivalent to launchd on macOS and systemd on Linux.

#### Scenario: NSSM already installed
- **WHEN** `setupWindows()` is called and `nssm` is already on PATH
- **THEN** it proceeds directly to register the service without attempting installation

#### Scenario: NSSM missing, winget available
- **WHEN** `setupWindows()` is called and `nssm` is not on PATH but `winget` is available
- **THEN** it installs NSSM via `winget install nssm --silent --accept-package-agreements --accept-source-agreements`
- **AND** continues to register the service using the absolute NSSM path

#### Scenario: NSSM missing, winget unavailable
- **WHEN** `setupWindows()` is called and neither `nssm` nor `winget` is available
- **THEN** it emits `SETUP_SERVICE` status with `SERVICE_TYPE: 'nssm'`, `STATUS: 'failed'`, `ERROR: 'nssm_install_failed'`, and a `HINT` pointing to the manual install URL
- **AND** exits the process with a non-zero code

### Requirement: Windows NSSM Service Configuration
`setupWindows()` SHALL configure the NSSM service with the Node.js executable, project entry point, working directory, HOME environment variable, and separate stdout/stderr log files, then start the service and emit `SETUP_SERVICE` status.

#### Scenario: Service registered and started successfully
- **WHEN** NSSM is available and `setupWindows()` registers and starts the service
- **THEN** the service is configured with `AppParameters`, `AppDirectory`, `AppEnvironmentExtra HOME=<homeDir>`, `AppStdout`, `AppStderr`, and `Start SERVICE_AUTO_START`
- **AND** `emitStatus('SETUP_SERVICE', { SERVICE_TYPE: 'nssm', STATUS: 'success', ... })` is called

### Requirement: Windows Bootstrap Script
A `setup.ps1` file SHALL exist at the project root, providing a Windows equivalent of `setup.sh`. It SHALL verify Node.js >= 20 is available, install npm dependencies, and invoke `npx tsx setup/index.ts`.

#### Scenario: Node.js present and >= 20
- **WHEN** `setup.ps1` is run and Node.js >= 20 is installed
- **THEN** it runs `npm install` and then `npx tsx setup/index.ts` without error

#### Scenario: Node.js absent
- **WHEN** `setup.ps1` is run and `node` is not found
- **THEN** it writes an error message directing the user to https://nodejs.org and exits with code 1

#### Scenario: Node.js below version 20
- **WHEN** `setup.ps1` is run and the installed Node.js major version is less than 20
- **THEN** it writes an error message showing the found version and exits with code 1
