## MODIFIED Requirements

### Requirement: Process Environment Setup

`src/process-runner.ts` 的 `buildEnv()` SHALL 构建子进程环境变量，传入 `NANOCLAW_GROUP_DIR`、`NANOCLAW_IPC_DIR`、`NANOCLAW_GLOBAL_DIR`、`NANOCLAW_IDENTITY_PATH`、`TZ`、`AGENT_BACKEND`，以及可选的 `NANOCLAW_EXTRA_DIR`。

`buildEnv()` SHALL NOT 覆盖 `HOME` 环境变量；子进程继承宿主进程的真实 `HOME`，确保 Claude Code / Cursor CLI 的登录凭证和全局配置可正常访问。

#### Scenario: 不覆盖 HOME

- **WHEN** `process-runner.ts` 构建子进程环境变量
- **THEN** 构建结果中不含 `HOME` 键，子进程继承宿主进程的真实 HOME

#### Scenario: 传入必要的 NANOCLAW_* 变量

- **WHEN** `process-runner.ts` spawn 子进程
- **THEN** 子进程环境包含 `NANOCLAW_GROUP_DIR`、`NANOCLAW_IPC_DIR`、`NANOCLAW_GLOBAL_DIR`、`NANOCLAW_IDENTITY_PATH`、`TZ`、`AGENT_BACKEND`

---

### Requirement: Group Directory Preparation

`src/process-runner.ts` 的 `prepareGroupDirs()` SHALL 在每次 agent 运行前初始化群组工作目录，将所有配置文件写入 `groups/{name}/`（即 `NANOCLAW_GROUP_DIR`）：

- `groups/{name}/.claude/settings.json`：Claude Code project-level feature flags（仅首次创建，存在则跳过）
- `groups/{name}/.claude/skills/`：从 `container/skills/` 同步 skill 文件（每次运行覆盖）
- IPC 目录：`data/ipc/{group}/messages/`、`data/ipc/{group}/tasks/`、`data/ipc/{group}/input/`

`prepareGroupDirs()` SHALL NOT 向 `data/sessions/` 目录写入任何配置。

#### Scenario: settings.json 写入 group workspace

- **WHEN** `prepareGroupDirs()` 被调用且 `groups/{name}/.claude/settings.json` 不存在
- **THEN** 文件被创建于 `groups/{name}/.claude/settings.json`，内容为 Claude Code feature flags JSON
- **AND** `data/sessions/` 目录下不产生任何新文件

#### Scenario: settings.json 已存在时跳过

- **WHEN** `groups/{name}/.claude/settings.json` 已存在
- **THEN** `prepareGroupDirs()` 不覆盖该文件

#### Scenario: skills 同步到 group workspace

- **WHEN** `container/skills/` 目录存在且包含子目录
- **THEN** 所有 skill 子目录被同步到 `groups/{name}/.claude/skills/`

#### Scenario: claude-runner 读取 project-level settings

- **WHEN** claude-runner 以 `settingSources: ['project', 'user']` 启动，cwd 为 `groups/{name}/`
- **THEN** `groups/{name}/.claude/settings.json` 中的 feature flags 生效
