import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeToolName, encodeToolName, McpManager } from "./manager.js";

vi.mock("./client.js", () => ({
  McpClient: vi.fn(),
}));

vi.mock("./stdio-transport.js", () => ({
  StdioTransport: vi.fn(),
}));

vi.mock("./http-transport.js", () => ({
  HttpTransport: vi.fn(),
}));

import { McpClient } from "./client.js";
import { HttpTransport } from "./http-transport.js";
import { StdioTransport } from "./stdio-transport.js";

function createMockClient() {
  return {
    initialize: vi.fn().mockResolvedValue({
      protocolVersion: "2025-03-26",
      capabilities: {},
      serverInfo: { name: "mock", version: "1.0" },
    }),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "result" }],
    }),
    close: vi.fn(),
    onNotification: vi.fn(),
    getServerCapabilities: vi.fn().mockReturnValue({}),
  };
}

describe("encodeToolName", () => {
  it("encodes server and tool name", () => {
    expect(encodeToolName("filesystem", "read_file")).toBe(
      "mcp__filesystem__read_file",
    );
  });

  it("handles server names with hyphens", () => {
    expect(encodeToolName("my-server", "search")).toBe(
      "mcp__my-server__search",
    );
  });
});

describe("decodeToolName", () => {
  it("decodes a namespaced tool name", () => {
    expect(decodeToolName("mcp__filesystem__read_file")).toEqual({
      serverName: "filesystem",
      toolName: "read_file",
    });
  });

  it("returns null for non-MCP tool names", () => {
    expect(decodeToolName("read_file")).toBeNull();
    expect(decodeToolName("other__thing")).toBeNull();
  });

  it("returns null for malformed MCP names", () => {
    expect(decodeToolName("mcp__")).toBeNull();
    expect(decodeToolName("mcp__serveronly")).toBeNull();
  });

  it("handles tool names containing the separator", () => {
    const decoded = decodeToolName("mcp__server__tool__with__underscores");
    expect(decoded).toEqual({
      serverName: "server",
      toolName: "tool__with__underscores",
    });
  });
});

describe("McpManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
    vi.mocked(McpClient).mockImplementation(function () {
      return createMockClient();
    } as never);
    // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
    vi.mocked(StdioTransport).mockImplementation(function () {
      return {};
    } as never);
    // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
    vi.mocked(HttpTransport).mockImplementation(function () {
      return {};
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("startAll", () => {
    it("starts stdio servers", async () => {
      const manager = new McpManager();
      await manager.startAll({
        filesystem: {
          transport: "stdio",
          command: "npx",
          args: ["-y", "server-fs"],
        },
      });

      expect(StdioTransport).toHaveBeenCalledWith(
        "npx",
        ["-y", "server-fs"],
        undefined,
      );
      expect(McpClient).toHaveBeenCalled();
    });

    it("starts http servers", async () => {
      const manager = new McpManager();
      await manager.startAll({
        remote: {
          transport: "http",
          url: "https://mcp.example.com",
          headers: { Authorization: "Bearer token" },
        },
      });

      expect(HttpTransport).toHaveBeenCalledWith("https://mcp.example.com", {
        Authorization: "Bearer token",
      });
      expect(McpClient).toHaveBeenCalled();
    });

    it("starts multiple servers concurrently", async () => {
      const manager = new McpManager();
      await manager.startAll({
        fs: {
          transport: "stdio",
          command: "server-fs",
          args: [],
        },
        remote: {
          transport: "http",
          url: "https://mcp.example.com",
        },
      });

      expect(McpClient).toHaveBeenCalledTimes(2);
    });

    it("initializes each client", async () => {
      const mockClient = createMockClient();
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        fs: { transport: "stdio", command: "cmd", args: [] },
      });

      expect(mockClient.initialize).toHaveBeenCalled();
    });
  });

  describe("getToolDefinitions", () => {
    it("returns namespaced tool definitions", async () => {
      const mockClient = createMockClient();
      mockClient.listTools.mockResolvedValue([
        {
          name: "read_file",
          description: "Read a file",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
          },
        },
        {
          name: "search",
          description: "Search files",
          inputSchema: { type: "object", properties: {} },
        },
      ]);
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        filesystem: { transport: "stdio", command: "cmd", args: [] },
      });

      const definitions = await manager.getToolDefinitions();

      expect(definitions).toHaveLength(2);
      expect(definitions[0]).toEqual({
        type: "function",
        function: {
          name: "mcp__filesystem__read_file",
          description: "Read a file",
          parameters: {
            type: "object",
            properties: { path: { type: "string" } },
          },
        },
      });
      expect(definitions[1].function.name).toBe("mcp__filesystem__search");
    });

    it("aggregates tools from multiple servers", async () => {
      let callCount = 0;
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        const client = createMockClient();
        callCount++;
        if (callCount === 1) {
          client.listTools.mockResolvedValue([
            {
              name: "tool_a",
              description: "A",
              inputSchema: { type: "object" },
            },
          ]);
        } else {
          client.listTools.mockResolvedValue([
            {
              name: "tool_b",
              description: "B",
              inputSchema: { type: "object" },
            },
          ]);
        }
        return client;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        server1: { transport: "stdio", command: "cmd1", args: [] },
        server2: { transport: "stdio", command: "cmd2", args: [] },
      });

      const definitions = await manager.getToolDefinitions();
      const names = definitions.map((d) => d.function.name);

      expect(names).toContain("mcp__server1__tool_a");
      expect(names).toContain("mcp__server2__tool_b");
    });

    it("uses empty description when tool has none", async () => {
      const mockClient = createMockClient();
      mockClient.listTools.mockResolvedValue([
        {
          name: "no_desc",
          inputSchema: { type: "object" },
        },
      ]);
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        fs: { transport: "stdio", command: "cmd", args: [] },
      });

      const definitions = await manager.getToolDefinitions();
      expect(definitions[0].function.description).toBe("");
    });
  });

  describe("callTool", () => {
    it("routes call to correct server", async () => {
      const mockClient = createMockClient();
      mockClient.callTool.mockResolvedValue({
        content: [{ type: "text", text: "file contents" }],
      });
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        filesystem: { transport: "stdio", command: "cmd", args: [] },
      });

      const result = await manager.callTool("mcp__filesystem__read_file", {
        path: "/tmp/test",
      });

      expect(mockClient.callTool).toHaveBeenCalledWith("read_file", {
        path: "/tmp/test",
      });
      expect(result).toBe("file contents");
    });

    it("joins multiple content blocks", async () => {
      const mockClient = createMockClient();
      mockClient.callTool.mockResolvedValue({
        content: [
          { type: "text", text: "line 1" },
          { type: "text", text: "line 2" },
        ],
      });
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        fs: { transport: "stdio", command: "cmd", args: [] },
      });

      const result = await manager.callTool("mcp__fs__tool", {});
      expect(result).toBe("line 1\nline 2");
    });

    it("handles non-text content blocks", async () => {
      const mockClient = createMockClient();
      mockClient.callTool.mockResolvedValue({
        content: [{ type: "image", data: "base64..." }],
      });
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        fs: { transport: "stdio", command: "cmd", args: [] },
      });

      const result = await manager.callTool("mcp__fs__tool", {});
      expect(result).toBe("[image content]");
    });

    it("throws for non-MCP tool names", async () => {
      const manager = new McpManager();
      await expect(manager.callTool("read_file", {})).rejects.toThrow(
        "Not an MCP tool",
      );
    });

    it("throws for unknown server", async () => {
      const manager = new McpManager();
      await manager.startAll({});
      await expect(manager.callTool("mcp__unknown__tool", {})).rejects.toThrow(
        "MCP server not found: unknown",
      );
    });
  });

  describe("isMcpTool", () => {
    it("returns true for MCP-namespaced tools", () => {
      const manager = new McpManager();
      expect(manager.isMcpTool("mcp__fs__read")).toBe(true);
    });

    it("returns false for non-MCP tools", () => {
      const manager = new McpManager();
      expect(manager.isMcpTool("read_file")).toBe(false);
    });
  });

  describe("shutdown", () => {
    it("closes all clients", async () => {
      const mockClient = createMockClient();
      // biome-ignore lint/complexity/useArrowFunction: must use function for constructor mock
      vi.mocked(McpClient).mockImplementation(function () {
        return mockClient;
      } as never);

      const manager = new McpManager();
      await manager.startAll({
        fs: { transport: "stdio", command: "cmd", args: [] },
      });

      manager.shutdown();
      expect(mockClient.close).toHaveBeenCalled();
    });

    it("clears client map after shutdown", async () => {
      const manager = new McpManager();
      await manager.startAll({
        fs: { transport: "stdio", command: "cmd", args: [] },
      });

      manager.shutdown();

      const definitions = await manager.getToolDefinitions();
      expect(definitions).toHaveLength(0);
    });

    it("clears auto-approve settings after shutdown", async () => {
      const manager = new McpManager();
      await manager.startAll({
        fs: {
          transport: "stdio",
          command: "cmd",
          args: [],
          autoApprove: true,
        },
      });

      expect(manager.isAutoApproved("mcp__fs__tool")).toBe(true);
      manager.shutdown();
      expect(manager.isAutoApproved("mcp__fs__tool")).toBe(false);
    });
  });

  describe("isAutoApproved", () => {
    it("returns true for auto-approved servers", async () => {
      const manager = new McpManager();
      await manager.startAll({
        trusted: {
          transport: "stdio",
          command: "cmd",
          args: [],
          autoApprove: true,
        },
      });

      expect(manager.isAutoApproved("mcp__trusted__any_tool")).toBe(true);
    });

    it("returns false for servers without autoApprove", async () => {
      const manager = new McpManager();
      await manager.startAll({
        untrusted: { transport: "stdio", command: "cmd", args: [] },
      });

      expect(manager.isAutoApproved("mcp__untrusted__any_tool")).toBe(false);
    });

    it("returns false for non-MCP tool names", () => {
      const manager = new McpManager();
      expect(manager.isAutoApproved("read_file")).toBe(false);
    });

    it("returns false for unknown servers", async () => {
      const manager = new McpManager();
      await manager.startAll({});
      expect(manager.isAutoApproved("mcp__unknown__tool")).toBe(false);
    });
  });
});
