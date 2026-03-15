# Change: Add Homebrew paths to launchd plist PATH template

## Why

`launchd` 启动的服务运行在受限 PATH 下。Apple Silicon Mac 的 Homebrew 将二进制安装到 `/opt/homebrew/bin`，而模版当前的 PATH 不包含该路径，导致 `whisper-cli`、`ffmpeg` 等工具在服务进程中不可用。

## What Changes

- `launchd/com.nanoclaw.plist` 模版 PATH 由
  `{{HOME}}/.local/bin:/usr/local/bin:/usr/bin:/bin`
  改为
  `{{HOME}}/.local/bin:/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin`

## Impact

- Affected specs: `launchd-service`
- Affected code: `launchd/com.nanoclaw.plist`
- 非破坏性：在不使用 Homebrew 的环境中多余路径被静默忽略
