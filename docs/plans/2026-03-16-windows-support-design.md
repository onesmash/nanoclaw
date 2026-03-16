# Windows 支持设计

## 背景

NanoClaw 原来依赖容器（Apple Container/Docker）运行 agent，现已改为直接 spawn Node.js 子进程。这大幅简化了 Windows 支持的复杂度——核心代码已经是跨平台的，主要缺口是信号处理、服务管理和 setup 引导脚本。

## 目标

在 Windows 上以 NSSM 注册 NanoClaw 为后台服务，行为与 macOS launchd / Linux systemd 对等（开机自启、崩溃自重启、日志重定向）。

## 不需要改的部分

- `src/` 核心逻辑（路径用 `path.join`，文件操作用 `fs`，均跨平台）
- SQLite 数据库
- 频道模块（Zoom、Feishu 等）
- 信号处理中的 `SIGTERM`/`SIGKILL`：Node.js 在 Windows 上将二者均转为 `TerminateProcess()`，行为一致，无需修改

## 改动清单

### 1. `src/index.ts` — 补充 SIGBREAK（+3 行）

Windows 服务通过 `SIGBREAK` 通知进程关闭（Ctrl+Break），需补充处理：

```typescript
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => shutdown('SIGBREAK'));
}
```

### 2. `src/config.ts` — Windows 路径修复（+5 行）

`sender-allowlist.json` 存储路径在 Windows 应使用 `%APPDATA%`：

```typescript
const CONFIG_DIR = process.platform === 'win32'
  ? path.join(process.env.APPDATA || os.homedir(), 'nanoclaw')
  : path.join(os.homedir(), '.config', 'nanoclaw');
export const SENDER_ALLOWLIST_PATH = path.join(CONFIG_DIR, 'sender-allowlist.json');
```

### 3. `setup/platform.ts` — Windows 平台检测

- `Platform` 类型加 `'windows'`
- `getPlatform()` 加 `if (platform === 'win32') return 'windows'`
- `ServiceManager` 类型加 `'nssm'`，`getServiceManager()` 对 `'windows'` 返回 `'nssm'`
- `getNodePath()` 和 `commandExists()` 使用 `command -v`（仅 Unix），Windows 改用 `where.exe`：

```typescript
export function commandExists(name: string): boolean {
  const cmd = process.platform === 'win32' ? `where.exe ${name}` : `command -v ${name}`;
  try {
    execSync(cmd, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

### 4. `setup/service.ts` — 新增 `setupWindows()`

在 `run()` 里加 `else if (platform === 'windows') { setupWindows(...) }`。

`setupWindows()` 逻辑：
1. 检查 NSSM 是否存在（`where.exe nssm`），不存在则自动安装：
   ```typescript
   if (!commandExists('nssm')) {
     logger.info('NSSM not found, installing via winget...');
     try {
       execSync('winget install nssm --silent --accept-package-agreements --accept-source-agreements', {
         stdio: 'inherit',
       });
     } catch {
       // winget 不可用时给出手动安装指引
       emitStatus('SETUP_SERVICE', {
         SERVICE_TYPE: 'nssm',
         STATUS: 'failed',
         ERROR: 'nssm_install_failed',
         HINT: 'Install NSSM manually: https://nssm.cc/download or run: winget install nssm',
       });
       process.exit(1);
     }
     // winget 安装后 PATH 不会立即刷新，需用绝对路径调用
     // 默认安装路径：C:\Program Files\NSSM\win64\nssm.exe
   }
   ```
2. 注册服务：
   ```
   nssm install nanoclaw <nodePath>
   nssm set nanoclaw AppParameters <projectRoot>\dist\index.js
   nssm set nanoclaw AppDirectory <projectRoot>
   nssm set nanoclaw AppEnvironmentExtra HOME=<homeDir>
   nssm set nanoclaw AppStdout <projectRoot>\logs\nanoclaw.log
   nssm set nanoclaw AppStderr <projectRoot>\logs\nanoclaw.error.log
   nssm set nanoclaw Start SERVICE_AUTO_START
   nssm start nanoclaw
   ```
3. `emitStatus('SETUP_SERVICE', { SERVICE_TYPE: 'nssm', ... })`

### 5. `setup.ps1` — Windows 引导脚本（新增，~30 行）

与 `setup.sh` 职责对等：检查 Node.js >= 20，npm install，然后调 TypeScript setup 模块：

```powershell
# setup.ps1 — Windows bootstrap for NanoClaw
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# 检查 Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
  Write-Error "Node.js not found. Install from https://nodejs.org (>= 20)"
  exit 1
}
$major = [int]($nodeVersion -replace 'v(\d+).*', '$1')
if ($major -lt 20) {
  Write-Error "Node.js >= 20 required, found $nodeVersion"
  exit 1
}

# 安装依赖
Set-Location $ProjectRoot
npm install

# 调 TypeScript setup 模块（含 Windows 服务注册）
npx tsx setup/index.ts
```

## 服务管理命令（补充到 CLAUDE.md）

```
# Windows (NSSM)
nssm start nanoclaw
nssm stop nanoclaw
nssm restart nanoclaw
nssm status nanoclaw
```

## 前提条件

- Windows 10/11
- Node.js >= 20（从 https://nodejs.org 安装）
- NSSM（setup 过程中通过 `winget install nssm` 自动安装，或手动安装）
- PowerShell 5.1+（Windows 内置）

## 不在范围内

- WSL2 支持（原生 Windows 进程方案已足够，WSL2 作为可选补充）
- Windows ARM 架构（Node.js 支持，但未验证）
