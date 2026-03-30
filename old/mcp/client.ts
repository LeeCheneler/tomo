import type {
  JsonRpcNotification,
  JsonRpcResponse,
  McpInitializeResult,
  McpToolCallResult,
  McpToolDefinition,
  McpToolsListResult,
  McpTransport,
} from "./types.js";

const PROTOCOL_VERSION = "2025-03-26";

/**
 * MCP client that manages the protocol lifecycle over a transport.
 * Handles initialize handshake, tool discovery, and tool invocation.
 */
export class McpClient {
  private nextId = 1;
  private serverCapabilities: Record<string, unknown> = {};
  private notificationHandler:
    | ((notification: JsonRpcNotification) => void)
    | null = null;

  constructor(private transport: McpTransport) {}

  /** Start the server process and perform the MCP initialize handshake. */
  async initialize(): Promise<McpInitializeResult> {
    this.transport.start();

    this.transport.onNotification((notification) => {
      this.notificationHandler?.(notification);
    });

    const response = await this.request("initialize", {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: "tomo", version: "0.0.0" },
    });

    if (response.error) {
      throw new Error(
        `MCP initialize failed: ${response.error.message} (code ${response.error.code})`,
      );
    }

    const result = response.result as McpInitializeResult;
    this.serverCapabilities = result.capabilities;

    this.transport.notify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    return result;
  }

  /** Fetch the list of tools the server exposes. */
  async listTools(): Promise<McpToolDefinition[]> {
    const response = await this.request("tools/list", {});

    if (response.error) {
      throw new Error(
        `MCP tools/list failed: ${response.error.message} (code ${response.error.code})`,
      );
    }

    const result = response.result as McpToolsListResult;
    return result.tools;
  }

  /** Invoke a tool on the server. */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<McpToolCallResult> {
    const response = await this.request("tools/call", {
      name,
      arguments: args,
    });

    if (response.error) {
      throw new Error(
        `MCP tools/call failed: ${response.error.message} (code ${response.error.code})`,
      );
    }

    return response.result as McpToolCallResult;
  }

  /** Register a handler for server-initiated notifications. */
  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  /** Returns the server capabilities from the initialize handshake. */
  getServerCapabilities(): Record<string, unknown> {
    return this.serverCapabilities;
  }

  /** Shut down the server process. */
  close(): void {
    this.transport.close();
  }

  private async request(
    method: string,
    params: Record<string, unknown>,
  ): Promise<JsonRpcResponse> {
    const id = this.nextId++;
    return this.transport.request({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });
  }
}
