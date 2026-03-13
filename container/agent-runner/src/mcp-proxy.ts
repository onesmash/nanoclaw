/**
 * MCP aggregating proxy for cursor-runner.
 * Usage: node mcp-proxy.js <port> <config-json-path>
 *
 * Reads an mcpServers config, connects to each server via the appropriate
 * transport, aggregates all tools under namespaced names, and exposes a
 * single StreamableHTTP endpoint on 127.0.0.1:<port>.
 */
import fs from 'fs';
import http from 'http';
import { randomUUID } from 'crypto';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

type StdioEntry = { command: string; args?: string[]; env?: Record<string, string> };
type HttpEntry = { url: string };
type McpServerEntry = StdioEntry | HttpEntry;
type McpConfig = { mcpServers: Record<string, McpServerEntry> };

function buildClientTransport(entry: McpServerEntry) {
  if ('command' in entry) {
    return new StdioClientTransport({
      command: entry.command,
      args: entry.args,
      env: entry.env,
      stderr: 'pipe',
    });
  }
  return new StreamableHTTPClientTransport(new URL(entry.url));
}

async function buildProxy(config: McpConfig, port: number): Promise<void> {
  // namespace → client, used for routing callTool and diffing on reload
  const activeClients = new Map<string, Client>();
  // all aggregated tools with prefixed names (rebuilt on reload)
  let allTools: Tool[] = [];

  for (const [name, entry] of Object.entries(config.mcpServers)) {
    const client = new Client({ name: `proxy-${name}`, version: '1.0.0' });
    try {
      await client.connect(buildClientTransport(entry));
    } catch (err) {
      process.stderr.write(`[mcp-proxy] Failed to connect to "${name}": ${err}\n`);
      continue;
    }

    let tools: Tool[] = [];
    try {
      const result = await client.listTools();
      tools = result.tools;
    } catch (err) {
      process.stderr.write(`[mcp-proxy] Failed to list tools for "${name}": ${err}\n`);
    }

    for (const tool of tools) {
      allTools.push({ ...tool, name: `${name}__${tool.name}` });
    }
    activeClients.set(name, client);
  }

  // Per-session transport map: session ID → transport instance
  const sessionTransports = new Map<string, StreamableHTTPServerTransport>();

  function createServerForSession(): Server {
    const server = new Server(
      { name: 'mcp-proxy', version: '1.0.0' },
      { capabilities: { tools: {} } },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: allTools }));
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const prefixed = request.params.name;
      const sep = prefixed.indexOf('__');
      if (sep === -1) throw new Error(`Unknown tool: ${prefixed}`);
      const namespace = prefixed.slice(0, sep);
      const toolName = prefixed.slice(sep + 2);
      const client = activeClients.get(namespace);
      if (!client) throw new Error(`No client for namespace: ${namespace}`);
      return client.callTool({ name: toolName, arguments: request.params.arguments });
    });
    return server;
  }

  // currentHandler is the delegate for all non-/reload requests.
  // It is swapped atomically on reload by reassigning this variable.
  // The http.createServer closure always reads the current value.
  let currentHandler = buildSessionHandler();

  function buildSessionHandler(): (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void> {
    return async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;

      // Reuse existing transport for this session
      if (sessionId && sessionTransports.has(sessionId)) {
        await sessionTransports.get(sessionId)!.handleRequest(req, res);
        return;
      }

      // New session: create a fresh transport + server pair
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          sessionTransports.set(id, transport);
          transport.onclose = () => sessionTransports.delete(id);
        },
      });

      const server = createServerForSession();
      await server.connect(transport);
      await transport.handleRequest(req, res);
    };
  }

  const httpServer = http.createServer(async (req, res) => {
    if (req.method === 'POST' && req.url === '/reload') {
      try {
        const newConfig: McpConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const oldNames = new Set(activeClients.keys());
        const newNames = new Set(Object.keys(newConfig.mcpServers));

        // Close removed clients
        for (const name of oldNames) {
          if (!newNames.has(name)) {
            try { await activeClients.get(name)!.close(); } catch { /* ignore */ }
            activeClients.delete(name);
            process.stderr.write(`[mcp-proxy] Removed client: ${name}\n`);
          }
        }

        // Connect new clients
        for (const name of newNames) {
          if (!oldNames.has(name)) {
            const entry = newConfig.mcpServers[name];
            const client = new Client({ name: `proxy-${name}`, version: '1.0.0' });
            try {
              await client.connect(buildClientTransport(entry));
              activeClients.set(name, client);
              process.stderr.write(`[mcp-proxy] Connected new client: ${name}\n`);
            } catch (err) {
              process.stderr.write(`[mcp-proxy] Failed to connect to "${name}": ${err}\n`);
            }
          }
        }

        // Rebuild allTools from all active clients
        allTools = [];
        for (const [name, client] of activeClients) {
          let tools: Tool[] = [];
          try {
            const result = await client.listTools();
            tools = result.tools;
          } catch (err) {
            process.stderr.write(`[mcp-proxy] Failed to list tools for "${name}": ${err}\n`);
          }
          for (const tool of tools) {
            allTools.push({ ...tool, name: `${name}__${tool.name}` });
          }
        }

        // Swap the session request handler so new sessions use the updated allTools
        currentHandler = buildSessionHandler();

        // Send notifications/tools/list_changed to all open sessions
        for (const [, transport] of sessionTransports) {
          try {
            await transport.send({
              jsonrpc: '2.0',
              method: 'notifications/tools/list_changed',
            });
          } catch { /* ignore if session is closed */ }
        }

        process.stderr.write(`[mcp-proxy] Reloaded: ${allTools.length} tools from ${activeClients.size} servers\n`);
        res.writeHead(200);
        res.end('ok');
      } catch (err) {
        process.stderr.write(`[mcp-proxy] Reload failed: ${err}\n`);
        res.writeHead(500);
        res.end('reload failed');
      }
      return;
    }

    await currentHandler(req, res);
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, '127.0.0.1', resolve);
  });

  process.stderr.write(`[mcp-proxy] Ready on http://127.0.0.1:${port} (${allTools.length} tools from ${activeClients.size} servers)\n`);
}

const [, , portArg, configPath] = process.argv;
if (!portArg || !configPath) {
  process.stderr.write('Usage: node mcp-proxy.js <port> <config-json-path>\n');
  process.exit(1);
}

const config: McpConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
await buildProxy(config, parseInt(portArg, 10));
