import type { McpConnection } from "../config/schema";
import type { McpClient, McpToolDefinition } from "./client";
import { createMcpClient } from "./client";

/** Factory that creates an MCP client for a given connection. */
export type McpClientFactory = (connection: McpConnection) => McpClient;

/** Result of starting a single MCP server. */
export interface StartResult {
  name: string;
  client: McpClient;
  tools: McpToolDefinition[];
}

/** Result of starting all MCP servers in parallel. */
export interface StartAllResult {
  /** Servers that connected and listed their tools successfully. */
  started: StartResult[];
  /** Servers that failed to connect or list tools, with the error message. */
  failed: { name: string; error: string }[];
}

/** Manages the lifecycle of MCP server connections. */
export interface McpManager {
  /** Connects to all enabled servers in parallel. Returns started and failed lists. */
  startAll: (
    connections: Record<string, McpConnection>,
  ) => Promise<StartAllResult>;
  /** Connects to a single server by name. Throws on failure. */
  start: (name: string, connection: McpConnection) => Promise<StartResult>;
  /** Disconnects a single server by name. No-op if not connected. */
  stop: (name: string) => Promise<void>;
  /** Disconnects all connected servers. */
  stopAll: () => Promise<void>;
  /** Returns the client for the named server, or undefined if not connected. */
  getClient: (name: string) => McpClient | undefined;
  /** Returns the names of all currently connected servers. */
  listConnected: () => string[];
}

/**
 * Creates a new MCP manager. The optional `clientFactory` parameter lets
 * tests inject a fake client without spawning real subprocesses.
 */
export function createMcpManager(
  clientFactory: McpClientFactory = createMcpClient,
): McpManager {
  const clients = new Map<string, McpClient>();

  async function start(
    name: string,
    connection: McpConnection,
  ): Promise<StartResult> {
    const client = clientFactory(connection);
    try {
      await client.connect();
      const tools = await client.listTools();
      clients.set(name, client);
      return { name, client, tools };
    } catch (error) {
      // Best-effort cleanup so a half-connected client doesn't leak.
      try {
        await client.disconnect();
      } catch {
        // Ignore — the connect already failed.
      }
      throw error;
    }
  }

  async function stop(name: string): Promise<void> {
    const client = clients.get(name);
    if (!client) return;
    clients.delete(name);
    try {
      await client.disconnect();
    } catch {
      // Ignore — the process is gone or never started cleanly.
    }
  }

  return {
    async startAll(connections) {
      const entries = Object.entries(connections).filter(
        ([, conn]) => conn.enabled !== false,
      );
      const results = await Promise.allSettled(
        entries.map(([name, conn]) => start(name, conn)),
      );

      const started: StartResult[] = [];
      const failed: { name: string; error: string }[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const name = entries[i][0];
        if (result.status === "fulfilled") {
          started.push(result.value);
        } else {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason);
          failed.push({ name, error: message });
        }
      }
      return { started, failed };
    },

    start,
    stop,

    async stopAll() {
      const names = [...clients.keys()];
      await Promise.all(names.map((name) => stop(name)));
    },

    getClient(name) {
      return clients.get(name);
    },

    listConnected() {
      return [...clients.keys()];
    },
  };
}
