import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "../tools";
import {
  executeToolCalls,
  formatToolHeader,
  ToolDismissedError,
} from "./tool-execution";

vi.mock("../tools", () => ({
  getTool: vi.fn(),
  getToolDisplayName: (name: string) => name,
}));

const mockContext = {
  renderInteractive: vi.fn(),
  reportProgress: vi.fn(),
  permissions: {},
  signal: new AbortController().signal,
  depth: 0,
  providerConfig: {
    baseUrl: "http://localhost",
    model: "test-model",
    apiKey: undefined,
    maxTokens: 1024,
    contextWindow: 8192,
  },

  allowedCommands: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("formatToolHeader", () => {
  it("formats name with args summary", () => {
    const header = formatToolHeader(
      "read_file",
      JSON.stringify({ path: "src/index.ts" }),
    );
    expect(header).toContain("read_file");
    expect(header).toContain("path: src/index.ts");
  });

  it("truncates long arg values", () => {
    const longPath = "a".repeat(100);
    const header = formatToolHeader(
      "read_file",
      JSON.stringify({ path: longPath }),
    );
    expect(header).toContain("read_file");
    expect(header).toContain("…");
    expect(header).not.toContain(longPath);
  });

  it("formats array args as item count", () => {
    const header = formatToolHeader(
      "ask",
      JSON.stringify({ options: ["a", "b", "c"] }),
    );
    expect(header).toContain("[3 items]");
  });

  it("handles malformed JSON gracefully", () => {
    const header = formatToolHeader("ask", "not json");
    expect(header).toContain("ask");
  });

  it("handles empty args object", () => {
    const header = formatToolHeader("ask", "{}");
    expect(header).toContain("ask");
  });
});

describe("executeToolCalls", () => {
  it("executes a single tool call and returns result", async () => {
    vi.mocked(getTool).mockReturnValue({
      name: "read_file",
      description: "Read a file",
      parameters: {},
      interactive: false,
      execute: async () => "file contents",
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "read_file", arguments: '{"path":"x"}' },
        },
      ],
      controller.signal,
      mockContext,
    );

    expect(results).toHaveLength(1);
    expect(results[0].role).toBe("tool");
    expect(results[0].content).toContain("file contents");
    expect(results[0]).toEqual(
      expect.objectContaining({ tool_call_id: "tc1" }),
    );
  });

  it("returns error for unknown tools", async () => {
    vi.mocked(getTool).mockReturnValue(undefined);

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "bogus", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
    );

    expect(results[0].content).toContain('unknown tool "bogus"');
  });

  it("catches tool execution errors", async () => {
    vi.mocked(getTool).mockReturnValue({
      name: "fail",
      description: "Fails",
      parameters: {},
      execute: async () => {
        throw new Error("boom");
      },
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "fail", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
    );

    expect(results[0].content).toContain("boom");
  });

  it("re-throws ToolDismissedError", async () => {
    vi.mocked(getTool).mockReturnValue({
      name: "ask",
      description: "Ask",
      parameters: {},
      execute: async () => {
        throw new ToolDismissedError();
      },
    });

    const controller = new AbortController();
    await expect(
      executeToolCalls(
        [
          {
            id: "tc1",
            type: "function",
            function: { name: "ask", arguments: "{}" },
          },
        ],
        controller.signal,
        mockContext,
      ),
    ).rejects.toThrow(ToolDismissedError);
  });

  it("runs non-interactive tools in parallel", async () => {
    const callOrder: string[] = [];
    vi.mocked(getTool).mockImplementation((name) => ({
      name: name ?? "",
      description: "",
      parameters: {},
      interactive: false,
      execute: async () => {
        callOrder.push(name ?? "");
        return `result-${name}`;
      },
    }));

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "glob", arguments: "{}" },
        },
        {
          id: "tc2",
          type: "function",
          function: { name: "grep", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
    );

    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("result-glob");
    expect(results[1].content).toContain("result-grep");
    expect(results[0]).toEqual(
      expect.objectContaining({ tool_call_id: "tc1" }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({ tool_call_id: "tc2" }),
    );
  });

  it("preserves original tool call order in results", async () => {
    // Mix interactive and non-interactive tools
    vi.mocked(getTool).mockImplementation((name) => ({
      name: name ?? "",
      description: "",
      parameters: {},
      interactive: name === "ask",
      execute: async () => `result-${name}`,
    }));

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "ask", arguments: "{}" },
        },
        {
          id: "tc2",
          type: "function",
          function: { name: "glob", arguments: "{}" },
        },
        {
          id: "tc3",
          type: "function",
          function: { name: "ask", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
    );

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual(
      expect.objectContaining({ tool_call_id: "tc1" }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({ tool_call_id: "tc2" }),
    );
    expect(results[2]).toEqual(
      expect.objectContaining({ tool_call_id: "tc3" }),
    );
  });

  it("aborts interactive tools when signal is aborted", async () => {
    vi.mocked(getTool).mockReturnValue({
      name: "ask",
      description: "Ask",
      parameters: {},
      interactive: true,
      execute: async () => "result",
    });

    const controller = new AbortController();
    controller.abort();

    await expect(
      executeToolCalls(
        [
          {
            id: "tc1",
            type: "function",
            function: { name: "ask", arguments: "{}" },
          },
        ],
        controller.signal,
        mockContext,
      ),
    ).rejects.toThrow("aborted");
  });
});

describe("executeToolCalls with mcpManager", () => {
  function createMockMcpManager(overrides?: Record<string, unknown>) {
    return {
      isMcpTool: vi.fn((name: string) => name.startsWith("mcp__")),
      callTool: vi.fn().mockResolvedValue("mcp result"),
      ...overrides,
    };
  }

  it("routes MCP tool calls through the manager", async () => {
    const mcpManager = createMockMcpManager();
    vi.mocked(getTool).mockReturnValue(undefined);

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: {
            name: "mcp__fs__read_file",
            arguments: '{"path":"/tmp/test"}',
          },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
    );

    expect(mcpManager.callTool).toHaveBeenCalledWith("mcp__fs__read_file", {
      path: "/tmp/test",
    });
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("mcp result");
    expect(results[0]).toEqual(
      expect.objectContaining({ tool_call_id: "tc1" }),
    );
  });

  it("routes built-in tools through the registry even when manager present", async () => {
    const mcpManager = createMockMcpManager({
      isMcpTool: vi.fn(() => false),
    });
    vi.mocked(getTool).mockReturnValue({
      name: "read_file",
      description: "Read a file",
      parameters: {},
      interactive: false,
      execute: async () => "builtin result",
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "read_file", arguments: '{"path":"x"}' },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
    );

    expect(mcpManager.callTool).not.toHaveBeenCalled();
    expect(results[0].content).toContain("builtin result");
  });

  it("treats MCP tools as non-interactive (parallel)", async () => {
    const callOrder: string[] = [];
    const mcpManager = createMockMcpManager({
      callTool: vi.fn(async (name: string) => {
        callOrder.push(name);
        return `result-${name}`;
      }),
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "mcp__fs__tool_a", arguments: "{}" },
        },
        {
          id: "tc2",
          type: "function",
          function: { name: "mcp__fs__tool_b", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual(
      expect.objectContaining({ tool_call_id: "tc1" }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({ tool_call_id: "tc2" }),
    );
  });

  it("handles MCP tool call errors gracefully", async () => {
    const mcpManager = createMockMcpManager({
      callTool: vi.fn().mockRejectedValue(new Error("server crashed")),
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "mcp__fs__broken", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
    );

    expect(results[0].content).toContain("server crashed");
  });

  it("handles mixed MCP and built-in tool calls", async () => {
    const mcpManager = createMockMcpManager();
    vi.mocked(getTool).mockReturnValue({
      name: "glob",
      description: "Glob",
      parameters: {},
      interactive: false,
      execute: async () => "glob result",
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "glob", arguments: '{"pattern":"*.ts"}' },
        },
        {
          id: "tc2",
          type: "function",
          function: { name: "mcp__db__query", arguments: '{"sql":"SELECT 1"}' },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
    );

    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("glob result");
    expect(results[1].content).toContain("mcp result");
    expect(results[0]).toEqual(
      expect.objectContaining({ tool_call_id: "tc1" }),
    );
    expect(results[1]).toEqual(
      expect.objectContaining({ tool_call_id: "tc2" }),
    );
  });

  it("returns disabled message when MCP tool is disabled in availability", async () => {
    const mcpManager = createMockMcpManager();

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: {
            name: "mcp__fs__read_file",
            arguments: "{}",
          },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
      { mcp__fs__read_file: false },
    );

    expect(mcpManager.callTool).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("disabled");
  });

  it("executes MCP tool when enabled in availability", async () => {
    const mcpManager = createMockMcpManager();

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: {
            name: "mcp__fs__read_file",
            arguments: "{}",
          },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
      { mcp__fs__read_file: true },
    );

    expect(mcpManager.callTool).toHaveBeenCalled();
    expect(results[0].content).toContain("mcp result");
  });

  it("executes MCP tool when availability entry is undefined", async () => {
    const mcpManager = createMockMcpManager();

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "mcp__fs__read_file", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
      {},
    );

    expect(mcpManager.callTool).toHaveBeenCalled();
    expect(results[0].content).toContain("mcp result");
  });

  it("blocks disabled tools but allows enabled in same call", async () => {
    const mcpManager = createMockMcpManager();

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "mcp__fs__read_file", arguments: "{}" },
        },
        {
          id: "tc2",
          type: "function",
          function: { name: "mcp__fs__search", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
      { mcp__fs__read_file: true, mcp__fs__search: false },
    );

    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("mcp result");
    expect(results[1].content).toContain("disabled");
  });

  it("handles disabled MCP tool alongside enabled built-in tool", async () => {
    const mcpManager = createMockMcpManager();
    vi.mocked(getTool).mockReturnValue({
      name: "glob",
      description: "Glob",
      parameters: {},
      interactive: false,
      execute: async () => "glob result",
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "glob", arguments: "{}" },
        },
        {
          id: "tc2",
          type: "function",
          function: { name: "mcp__fs__disabled_tool", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
      mcpManager as never,
      { mcp__fs__disabled_tool: false },
    );

    expect(results).toHaveLength(2);
    expect(results[0].content).toContain("glob result");
    expect(results[1].content).toContain("disabled");
    expect(mcpManager.callTool).not.toHaveBeenCalled();
  });

  it("returns disabled message for MCP tool when manager is undefined", async () => {
    vi.mocked(getTool).mockReturnValue(undefined);

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: {
            name: "mcp__fs__read_file",
            arguments: "{}",
          },
        },
      ],
      controller.signal,
      mockContext,
      undefined,
    );

    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("no longer available");
    expect(results[0].content).toContain("disabled");
  });

  it("works without mcpManager (undefined)", async () => {
    vi.mocked(getTool).mockReturnValue({
      name: "read_file",
      description: "Read",
      parameters: {},
      interactive: false,
      execute: async () => "file contents",
    });

    const controller = new AbortController();
    const results = await executeToolCalls(
      [
        {
          id: "tc1",
          type: "function",
          function: { name: "read_file", arguments: "{}" },
        },
      ],
      controller.signal,
      mockContext,
      undefined,
    );

    expect(results[0].content).toContain("file contents");
  });
});

describe("ToolDismissedError", () => {
  it("is an instance of Error", () => {
    const err = new ToolDismissedError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("The user dismissed the question.");
  });
});
