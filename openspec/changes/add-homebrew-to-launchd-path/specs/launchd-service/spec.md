## ADDED Requirements

### Requirement: Homebrew PATH in launchd service

launchd 服务的 `EnvironmentVariables.PATH` 模版 SHALL 包含 `/opt/homebrew/bin` 和 `/opt/homebrew/sbin`，位于 `/usr/local/bin` 之前。

#### Scenario: Apple Silicon Mac Homebrew 工具可被服务发现

- **WHEN** NanoClaw 以 launchd 服务运行，且通过 Homebrew 安装了工具（如 `whisper-cli`、`ffmpeg`）
- **THEN** 服务进程可以在 PATH 中找到这些工具，无需用户手动编辑 plist
