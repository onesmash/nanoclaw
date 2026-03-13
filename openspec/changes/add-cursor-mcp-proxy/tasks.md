## Tasks

### 1. Node.js proxy
- [x] 1.1 Create `container/agent-runner/src/mcp-proxy.ts` with:
  - `buildClientTransport(entry)`: returns `StdioClientTransport` for `command`/`args`/`env` entries, `StreamableHTTPClientTransport` for `url` entries
  - `buildProxy(config, port)`: connects a `Client` per server, calls `listTools()`, registers each tool on a `Server` with `${name}__${toolName}` prefix via `setRequestHandler`, routes `callTool` back to the correct client, starts `StreamableHTTPServerTransport` + `http.Server` on `127.0.0.1:<port>`
  - Entry point: reads `port` and `configPath` from `process.argv`, calls `buildProxy`
- [x] 1.2 Add `mcp-proxy.ts` to `tsconfig.json` build if needed; confirm `npm run build` compiles it

### 2. cursor-runner helpers
- [x] 2.1 Add `findFreePort(): Promise<number>` — open TCP server on port 0, return assigned port, close server
- [x] 2.2 Add `resolveConfig(groupDir, containerInput)` — read `<groupDir>/.cursor/mcp.json`, inject runtime env into `nanoclaw` entry (`NANOCLAW_IPC_DIR`, `NANOCLAW_CHAT_JID`, `NANOCLAW_GROUP_FOLDER`, `NANOCLAW_IS_MAIN`), return resolved config object; fall back to nanoclaw-only default if file missing
- [x] 2.3 Add `spawnProxy(port, configPath)` — spawn `node mcp-proxy.js <port> <configPath>`, pipe stderr to log, return `ChildProcess`
- [x] 2.4 Add `waitForProxy(port, timeoutMs)` — poll `http://127.0.0.1:<port>/` until any HTTP response or timeout; reject on timeout

### 3. cursor-runner main() wiring
- [x] 3.1 In `main()`: call `findFreePort` → `resolveConfig` → write resolved config to temp file → `spawnProxy` → `waitForProxy` → pass `[{ type: 'http', name: 'mcp-proxy', url: \`http://127.0.0.1:\${port}\` }]` to `newSession`/`loadSession`
- [x] 3.2 In `finally`: kill proxy child process, delete temp config file

### 4. Cleanup
- [x] 4.1 Remove `syncMcpJson()`, `writeMcpJson()`, and stdio `buildMcpServers()` from `cursor-runner.ts`
- [x] 4.2 Remove `NANOCLAW_PROJECT_ROOT` env var from `spawnEnv` if it was added only for syncMcpJson

### 5. Validation
- [x] 5.1 `npm run build` — zero TypeScript errors
- [ ] 5.2 Start a cursor-runner session; confirm proxy process appears in logs and ACP session is created successfully
- [ ] 5.3 Trigger `nanoclaw__send_message` from the agent; confirm message arrives via IPC
- [ ] 5.4 Confirm proxy process is killed after session ends (check `ps`)
