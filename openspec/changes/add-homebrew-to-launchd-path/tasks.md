## 1. Implementation

- [x] 1.1 更新 `launchd/com.nanoclaw.plist` 模版 PATH，在 `/usr/local/bin` 之前插入 `/opt/homebrew/bin:/opt/homebrew/sbin`
- [x] 1.2 验证：已安装服务的用户需要重新执行 `launchctl unload && launchctl load` 使新 PATH 生效（在 setup skill 文档中补充说明，若有 PATH 相关注意事项）
