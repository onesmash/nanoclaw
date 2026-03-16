## ADDED Requirements

### Requirement: Windows Prerequisites
The SKILL.md documentation SHALL state that Windows users require Windows 10/11, Node.js >= 20, and PowerShell 5.1 or later. It SHALL also note that users may need to allow script execution with `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` before running `setup.ps1`.

#### Scenario: User reads prerequisites on Windows
- **WHEN** a user opens the setup skill on Windows
- **THEN** they see the required OS version (Windows 10/11), Node.js minimum version (>= 20), PowerShell version (5.1+), and the Set-ExecutionPolicy hint

### Requirement: Windows Bootstrap Step
The SKILL.md Step 1 Bootstrap section SHALL instruct the assistant to detect the operating system and run `.\setup.ps1` (PowerShell) on Windows instead of `bash setup.sh`. The documentation SHALL describe what `setup.ps1` does: checks Node.js version >= 20, installs NSSM via `winget` if not already present, runs `npm install`, and runs `npx tsx setup/index.ts`.

#### Scenario: Bootstrap on Windows
- **WHEN** the assistant runs Step 1 on a Windows machine
- **THEN** it runs `.\setup.ps1` in PowerShell (not `bash setup.sh`)
- **AND** it parses the same status block output produced by `npx tsx setup/index.ts`

#### Scenario: Node.js missing on Windows
- **WHEN** `setup.ps1` reports Node.js is missing or below version 20
- **THEN** the assistant asks the user to install Node.js >= 20 from https://nodejs.org and re-run `.\setup.ps1`

#### Scenario: NSSM installed by setup.ps1
- **WHEN** NSSM is not on PATH during `setup.ps1`
- **THEN** the script installs it via `winget install nssm` and refreshes PATH before proceeding

### Requirement: Windows Service Management Commands
The SKILL.md Step 8 (Start Service) and Step 9 (Verify) sections SHALL include Windows-specific service management commands using NSSM. Specifically: `nssm start nanoclaw`, `nssm stop nanoclaw`, `nssm restart nanoclaw`, and `nssm status nanoclaw`.

#### Scenario: Starting the service on Windows
- **WHEN** the assistant runs Step 8 on Windows
- **THEN** it uses `nssm start nanoclaw` to start the service (not launchctl or systemctl)

#### Scenario: Restarting the service on Windows after a fix
- **WHEN** Step 9 Verify finds SERVICE=stopped on Windows
- **THEN** the assistant runs `nssm restart nanoclaw` to restart the service

#### Scenario: Stopping the service on Windows
- **WHEN** the user asks to unload or stop the service on Windows
- **THEN** the assistant runs `nssm stop nanoclaw`

### Requirement: Windows Troubleshooting Guidance
The SKILL.md Troubleshooting section SHALL include Windows-specific guidance for common failure modes: service not starting (check NSSM logs or `nssm status nanoclaw`), and how to stop or restart the service via NSSM.

#### Scenario: Service not starting on Windows
- **WHEN** the service fails to start on Windows
- **THEN** the assistant checks `nssm status nanoclaw` and reviews `logs/nanoclaw.error.log` for errors

#### Scenario: Unloading service on Windows
- **WHEN** a user wants to stop the background service on Windows
- **THEN** the assistant runs `nssm stop nanoclaw`
