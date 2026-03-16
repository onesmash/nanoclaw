## ADDED Requirements

### Requirement: Windows Config Directory Convention
`src/config.ts` SHALL derive `SENDER_ALLOWLIST_PATH` from `%APPDATA%\nanoclaw\sender-allowlist.json` on Windows (`process.platform === 'win32'`), falling back to `os.homedir()` if `APPDATA` is unset. On all other platforms the existing path `~/.config/nanoclaw/sender-allowlist.json` SHALL remain unchanged.

#### Scenario: Allowlist path on Windows with APPDATA set
- **WHEN** the process runs on Windows and `process.env.APPDATA` is defined
- **THEN** `SENDER_ALLOWLIST_PATH` resolves to `<APPDATA>\nanoclaw\sender-allowlist.json`

#### Scenario: Allowlist path on Windows without APPDATA
- **WHEN** the process runs on Windows and `process.env.APPDATA` is undefined
- **THEN** `SENDER_ALLOWLIST_PATH` resolves to `<os.homedir()>\nanoclaw\sender-allowlist.json`

#### Scenario: Allowlist path on macOS and Linux unchanged
- **WHEN** the process runs on macOS or Linux
- **THEN** `SENDER_ALLOWLIST_PATH` resolves to `<HOME>/.config/nanoclaw/sender-allowlist.json`, identical to current behavior
