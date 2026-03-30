import type { McpKvEntry, McpServerConfig } from "../config.js";
import type { ToolDefinition } from "../provider/client.js";
import { McpClient } from "./client.js";
import { HttpTransport } from "./http-transport.js";
import { StdioTransport } from "./stdio-transport.js";
import type { McpTransport } from "./types.js";

const NAMESPACE_SEP = "__";

/** Extract plain string values from a kv entry record for transport use. */
function kvEntriesToRecord(
  entries?: Record<string, McpKvEntry>,
): Record<string, string> | undefined {
  if (!entries) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(entries)) {
    result[key] = entry.value;
  }
  return result;
}

/** Creates the appropriate transport for an MCP server config. */
function createTransport(config: McpServerConfig): McpTransport {
  if (config.transport === "stdio") {
    return new StdioTransport(
      config.command,
      config.args,
      kvEntriesToRecord(config.env),
    );
  }
  return new HttpTransport(config.url, kvEntriesToRecord(config.headers));
}

/** Encodes a namespaced tool name: mcp__<server>__<tool>. */
export function encodeToolName(serverName: string, toolName: string): string {
  return `mcp${NAMESPACE_SEP}${serverName}${NAMESPACE_SEP}${toolName}`;
}

/** Decodes a namespaced tool name into server and tool parts. Returns null if not an MCP tool. */
export function decodeToolName(
  namespacedName: string,
): { serverName: string; toolName: string } | null {
  const prefix = `mcp${NAMESPACE_SEP}`;
  if (!namespacedName.startsWith(prefix)) return null;
  const rest = namespacedName.slice(prefix.length);
  const sepIndex = rest.indexOf(NAMESPACE_SEP);
  if (sepIndex === -1) return null;
  return {
    serverName: rest.slice(0, sepIndex),
    toolName: rest.slice(sepIndex + NAMESPACE_SEP.length),
  };
}

/**
 * Manages MCP server lifecycles: starts clients, discovers tools,
 * routes tool calls, and handles graceful shutdown.
 */
export class McpManager {
  private clients = new Map<string, McpClient>();
  private failedServerNames = new Set<string>();

  /** Start all configured MCP servers independently. Returns names of servers that failed to connect. */
  async startAll(servers: Record<string, McpServerConfig>): Promise<string[]> {
    const failures: string[] = [];
    const entries = Object.entries(servers);
    await Promise.all(
      entries.map(async ([name, config]) => {
        try {
          const transport = createTransport(config);
          const client = new McpClient(transport);
          await client.initialize();
          this.clients.set(name, client);
        } catch {
          failures.push(name);
          this.failedServerNames.add(name);
        }
      }),
    );
    return failures;
  }

  /** Get tool definitions from all servers, namespaced and in ToolDefinition format. */
  async getToolDefinitions(): Promise<ToolDefinition[]> {
    const definitions: ToolDefinition[] = [];
    for (const [serverName, client] of this.clients) {
      const tools = await client.listTools();
      for (const tool of tools) {
        definitions.push({
          type: "function",
          function: {
            name: encodeToolName(serverName, tool.name),
            description: tool.description ?? "",
            parameters: tool.inputSchema,
          },
        });
      }
    }
    return definitions;
  }

  /** Route a namespaced tool call to the correct server. */
  async callTool(
    namespacedName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    const decoded = decodeToolName(namespacedName);
    if (!decoded) {
      throw new Error(`Not an MCP tool: ${namespacedName}`);
    }

    const client = this.clients.get(decoded.serverName);
    if (!client) {
      throw new Error(`MCP server not found: ${decoded.serverName}`);
    }

    const result = await client.callTool(decoded.toolName, args);
    return result.content
      .map((block) => block.text ?? `[${block.type} content]`)
      .join("\n");
  }

  /** Returns true if the server failed to connect. */
  isServerFailed(name: string): boolean {
    return this.failedServerNames.has(name);
  }

  /** Returns the names of all connected servers. */
  getServerNames(): string[] {
    return [...this.clients.keys()];
  }

  /** Check if a tool name is an MCP-namespaced tool. */
  isMcpTool(name: string): boolean {
    return decodeToolName(name) !== null;
  }

  /** Shut down all MCP server connections. */
  shutdown(): void {
    for (const client of this.clients.values()) {
      client.close();
    }
    this.clients.clear();
    this.failedServerNames.clear();
  }
}
