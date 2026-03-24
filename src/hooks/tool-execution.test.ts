import { describe, it, expect, vi, beforeEach } from "vitest";
import { getTool } from "../tools";
import {
  ToolDismissedError,
  formatToolHeader,
  executeToolCalls,
} from "./tool-execution";

vi.mock("../tools", () => ({
  getTool: vi.fn(),
}));

const mockContext = {
  renderInteractive: vi.fn(),
  reportProgress: vi.fn(),
  permissions: {},
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

describe("ToolDismissedError", () => {
  it("is an instance of Error", () => {
    const err = new ToolDismissedError();
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("The user dismissed the question.");
  });
});
