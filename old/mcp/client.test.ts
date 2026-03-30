import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { McpClient } from "./client.js";
import type { JsonRpcResponse, McpTransport } from "./types.js";

function createMockTransport() {
  return {
    start: vi.fn(),
    request: vi.fn(),
    notify: vi.fn(),
    onNotification: vi.fn(),
    close: vi.fn(),
  } as unknown as McpTransport & {
    start: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
    notify: ReturnType<typeof vi.fn>;
    onNotification: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
}

function makeResponse(id: number, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function makeErrorResponse(
  id: number,
  code: number,
  message: string,
): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

describe("McpClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initialize", () => {
    it("performs the initialize handshake", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "test-server", version: "1.0" },
        }),
      );

      const result = await client.initialize();

      expect(transport.start).toHaveBeenCalled();
      expect(transport.request).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "tomo", version: "0.0.0" },
        },
      });
      expect(transport.notify).toHaveBeenCalledWith({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      });
      expect(result.serverInfo.name).toBe("test-server");
      expect(result.capabilities).toEqual({ tools: {} });
    });

    it("stores server capabilities", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: "test", version: "1.0" },
        }),
      );

      await client.initialize();
      expect(client.getServerCapabilities()).toEqual({
        tools: {},
        resources: {},
      });
    });

    it("throws on initialize error", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeErrorResponse(1, -32600, "Invalid request"),
      );

      await expect(client.initialize()).rejects.toThrow(
        "MCP initialize failed: Invalid request (code -32600)",
      );
    });

    it("forwards server notifications to registered handler", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);
      const handler = vi.fn();

      client.onNotification(handler);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );

      await client.initialize();

      expect(transport.onNotification).toHaveBeenCalled();

      // Simulate server notification via the registered transport handler
      const registeredHandler = transport.onNotification.mock.calls[0][0];
      registeredHandler({
        jsonrpc: "2.0",
        method: "notifications/tools/list_changed",
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "notifications/tools/list_changed",
        }),
      );
    });
  });

  describe("listTools", () => {
    it("returns tool definitions", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );
      await client.initialize();

      transport.request.mockResolvedValueOnce(
        makeResponse(2, {
          tools: [
            {
              name: "read_file",
              description: "Read a file",
              inputSchema: {
                type: "object",
                properties: { path: { type: "string" } },
                required: ["path"],
              },
            },
            {
              name: "search",
              description: "Search files",
              inputSchema: {
                type: "object",
                properties: { query: { type: "string" } },
              },
            },
          ],
        }),
      );

      const tools = await client.listTools();

      expect(transport.request).toHaveBeenLastCalledWith({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      });
      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe("read_file");
      expect(tools[1].name).toBe("search");
    });

    it("throws on error response", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );
      await client.initialize();

      transport.request.mockResolvedValueOnce(
        makeErrorResponse(2, -32601, "Method not found"),
      );

      await expect(client.listTools()).rejects.toThrow(
        "MCP tools/list failed: Method not found",
      );
    });
  });

  describe("callTool", () => {
    it("invokes a tool and returns the result", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );
      await client.initialize();

      transport.request.mockResolvedValueOnce(
        makeResponse(2, {
          content: [{ type: "text", text: "file contents here" }],
        }),
      );

      const result = await client.callTool("read_file", {
        path: "/tmp/test",
      });

      expect(transport.request).toHaveBeenLastCalledWith({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "read_file", arguments: { path: "/tmp/test" } },
      });
      expect(result.content).toEqual([
        { type: "text", text: "file contents here" },
      ]);
    });

    it("returns error result from tool", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );
      await client.initialize();

      transport.request.mockResolvedValueOnce(
        makeResponse(2, {
          content: [{ type: "text", text: "file not found" }],
          isError: true,
        }),
      );

      const result = await client.callTool("read_file", {
        path: "/nonexistent",
      });
      expect(result.isError).toBe(true);
    });

    it("throws on JSON-RPC error response", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );
      await client.initialize();

      transport.request.mockResolvedValueOnce(
        makeErrorResponse(2, -32602, "Invalid params"),
      );

      await expect(client.callTool("bad_tool", {})).rejects.toThrow(
        "MCP tools/call failed: Invalid params",
      );
    });
  });

  describe("close", () => {
    it("closes the transport", () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);
      client.close();
      expect(transport.close).toHaveBeenCalled();
    });
  });

  describe("request id incrementing", () => {
    it("increments request ids", async () => {
      const transport = createMockTransport();
      const client = new McpClient(transport);

      transport.request.mockResolvedValueOnce(
        makeResponse(1, {
          protocolVersion: "2025-03-26",
          capabilities: {},
          serverInfo: { name: "test", version: "1.0" },
        }),
      );
      await client.initialize();

      transport.request.mockResolvedValueOnce(makeResponse(2, { tools: [] }));
      await client.listTools();

      transport.request.mockResolvedValueOnce(makeResponse(3, { tools: [] }));
      await client.listTools();

      const ids = transport.request.mock.calls.map(
        (call) => (call[0] as { id: number }).id,
      );
      expect(ids).toEqual([1, 2, 3]);
    });
  });
});
