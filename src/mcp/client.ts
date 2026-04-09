import { Client } from "@modelcontextprotocol/sdk/client";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport";
import { z } from "zod";
import type { McpConnection } from "../config/schema";

/** A discovered tool exposed by an MCP server. */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** Result returned by a tool call to an MCP server. */
export interface McpCallResult {
  /** Concatenated text content from the result, or an error message. */
  text: string;
  /** Whether the server flagged the result as an error. */
  isError: boolean;
}

/** Stdio-only MCP client wrapper around the official SDK. */
export interface McpClient {
  /** Connects to the server and performs the initialize handshake. */
  connect: () => Promise<void>;
  /** Lists tools exposed by the server. Connect first. */
  listTools: () => Promise<McpToolDefinition[]>;
  /** Calls a tool by name with the given arguments. Connect first. */
  callTool: (
    name: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<McpCallResult>;
  /** Closes the underlying transport and kills the subprocess. */
  disconnect: () => Promise<void>;
}

/** Schema for the minimum shape we read from each MCP content block. */
const contentBlockSchema = z.object({
  type: z.string(),
  text: z.string().optional(),
});

/** Schema for the standard MCP CallTool result we depend on. */
const callToolResultSchema = z.object({
  content: z.array(z.unknown()).default([]),
  isError: z.boolean().optional(),
});

/** Concatenates the text blocks of an MCP CallTool result into a single string. */
export function flattenContent(content: readonly unknown[]): string {
  return content
    .map((raw) => {
      const parsed = contentBlockSchema.safeParse(raw);
      if (!parsed.success) return "";
      if (parsed.data.type === "text" && parsed.data.text !== undefined) {
        return parsed.data.text;
      }
      return `[${parsed.data.type} content]`;
    })
    .join("\n");
}

/**
 * Wraps an SDK transport in an `McpClient`, handling the protocol-layer
 * calls (`listTools`, `callTool`, `disconnect`). Shared between the stdio
 * and http factories so the protocol handling lives in one place.
 */
function wrapTransport(transport: Transport): McpClient {
  const client = new Client(
    { name: "tomo", version: "0.0.0" },
    { capabilities: {} },
  );

  return {
    async connect() {
      await client.connect(transport);
    },

    async listTools() {
      const result = await client.listTools();
      return result.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },

    async callTool(name, args, signal) {
      const raw = await client.callTool(
        { name, arguments: args },
        undefined,
        signal ? { signal } : undefined,
      );
      // The non-task call shape always has `content`. The task-based shape
      // (`toolResult`) is unused here, so the content branch always holds.
      const parsed = callToolResultSchema.parse(raw);
      return {
        text: flattenContent(parsed.content),
        isError: parsed.isError === true,
      };
    },

    async disconnect() {
      await transport.close();
    },
  };
}

/** Creates a stdio MCP client for the given connection config. */
export function createStdioMcpClient(connection: {
  command: string;
  args: readonly string[];
  env?: Record<string, string>;
}): McpClient {
  const transport = new StdioClientTransport({
    command: connection.command,
    args: [...connection.args],
    env: connection.env,
    // Capture stderr instead of letting it print over the Ink UI / test output.
    // We don't currently surface it anywhere — phase 3+ can pipe it to the chat log.
    stderr: "pipe",
  });
  return wrapTransport(transport);
}

/** Creates a streamable-HTTP MCP client for the given connection config. */
export function createHttpMcpClient(connection: {
  url: string;
  headers?: Record<string, string>;
}): McpClient {
  const transport = new StreamableHTTPClientTransport(new URL(connection.url), {
    requestInit: connection.headers ? { headers: connection.headers } : {},
  });
  return wrapTransport(transport);
}

/** Builds an MCP client from a connection config, dispatching on transport type. */
export function createMcpClient(connection: McpConnection): McpClient {
  if (connection.transport === "stdio") {
    return createStdioMcpClient({
      command: connection.command,
      args: connection.args,
      env: connection.env,
    });
  }
  return createHttpMcpClient({
    url: connection.url,
    headers: connection.headers,
  });
}
