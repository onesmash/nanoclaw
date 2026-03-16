## ADDED Requirements

### Requirement: Windows Platform Detection
The `getPlatform()` function in `setup/platform.ts` SHALL return `'windows'` when `os.platform()` returns `'win32'`, and the `Platform` type SHALL include `'windows'` as a valid value.

#### Scenario: Windows platform identified
- **WHEN** `getPlatform()` is called on a Windows host
- **THEN** it returns `'windows'`

#### Scenario: Non-Windows platforms unaffected
- **WHEN** `getPlatform()` is called on macOS or Linux
- **THEN** it returns `'macos'` or `'linux'` respectively, unchanged

### Requirement: NSSM Service Manager Detection
The `getServiceManager()` function SHALL return `'nssm'` for the `'windows'` platform, and the `ServiceManager` type SHALL include `'nssm'` as a valid value.

#### Scenario: Windows service manager resolved
- **WHEN** `getServiceManager()` is called on a Windows host
- **THEN** it returns `'nssm'`

### Requirement: Windows-Compatible Command Detection
The `commandExists()` function SHALL use `where.exe <name>` on `win32` and `command -v <name>` on all other platforms. The `getNodePath()` function SHALL use `where.exe node` to locate Node.js on `win32`.

#### Scenario: Command found on Windows
- **WHEN** `commandExists('nssm')` is called and `nssm` is on the system PATH on Windows
- **THEN** it returns `true`

#### Scenario: Command not found on Windows
- **WHEN** `commandExists('nssm')` is called and `nssm` is absent on Windows
- **THEN** it returns `false` without throwing

#### Scenario: Unix behavior unchanged
- **WHEN** `commandExists('node')` is called on macOS or Linux
- **THEN** it uses `command -v` and returns the same result as before
