/** JSON-RPC 2.0 request. */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

/** JSON-RPC 2.0 success response. */
export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: JsonRpcError;
}

/** JSON-RPC 2.0 error object. */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

/** JSON-RPC 2.0 notification (no id, no response expected). */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

/** MCP tool definition returned by tools/list. */
export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

/** MCP content block returned by tools/call. */
export interface McpContentBlock {
  type: string;
  text?: string;
}

/** MCP tools/list result. */
export interface McpToolsListResult {
  tools: McpToolDefinition[];
}

/** MCP tools/call result. */
export interface McpToolCallResult {
  content: McpContentBlock[];
  isError?: boolean;
}

/** MCP initialize result. */
export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: Record<string, unknown>;
  serverInfo: {
    name: string;
    version: string;
  };
}
