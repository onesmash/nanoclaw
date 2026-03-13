## ADDED Requirements

### Requirement: Symlink-Safe Project Root Write
Before writing the proxy URL to `{projectRoot}/.cursor/mcp.json`, `cursor-runner` SHALL
call `fs.lstatSync` on that path. If the path is a symbolic link, cursor-runner SHALL
`fs.unlinkSync` it and log the break before proceeding with `fs.writeFileSync`, so the
write always creates a plain file and never follows a link into `{groupDir}/.cursor/mcp.json`.

#### Scenario: Project root mcp.json is a symlink
- **GIVEN** `{projectRoot}/.cursor/mcp.json` is a symlink pointing to
  `groups/{name}/.cursor/mcp.json`
- **WHEN** cursor-runner prepares to write the proxy URL
- **THEN** the symlink is unlinked and a plain file is written at `{projectRoot}/.cursor/mcp.json`
- **AND** `groups/{name}/.cursor/mcp.json` on disk is NOT modified
- **AND** a log line records that the symlink was broken

#### Scenario: Project root mcp.json is a plain file
- **GIVEN** `{projectRoot}/.cursor/mcp.json` is a regular file or does not exist
- **WHEN** cursor-runner writes the proxy URL
- **THEN** the file is written normally with no symlink check overhead
