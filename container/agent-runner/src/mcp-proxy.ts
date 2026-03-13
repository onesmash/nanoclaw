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
  // namespace → client, used for routing callTool
  const clients = new Map<string, Client>();
  // all aggregated tools with prefixed names
  const allTools: Tool[] = [];

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
    clients.set(name, client);
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
      const client = clients.get(namespace);
      if (!client) throw new Error(`No client for namespace: ${namespace}`);
      return client.callTool({ name: toolName, arguments: request.params.arguments });
    });
    return server;
  }

  const httpServer = http.createServer(async (req, res) => {
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
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(port, '127.0.0.1', resolve);
  });

  process.stderr.write(`[mcp-proxy] Ready on http://127.0.0.1:${port} (${allTools.length} tools from ${clients.size} servers)\n`);
}

const [, , portArg, configPath] = process.argv;
if (!portArg || !configPath) {
  process.stderr.write('Usage: node mcp-proxy.js <port> <config-json-path>\n');
  process.exit(1);
}

const config: McpConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
await buildProxy(config, parseInt(portArg, 10));
