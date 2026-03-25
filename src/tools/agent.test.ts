import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompletionLoopOptions } from "../completion-loop";
import type { ToolContext } from "./types";
import { getTool } from "./registry";

vi.mock("../completion-loop", () => ({
  runCompletionLoop: vi.fn(),
}));

vi.mock("../instructions", () => ({
  loadInstructions: () => "System info here",
}));

// Import tools index to trigger all tool registrations.
await import("./index");

const { runCompletionLoop } = await import("../completion-loop");
const mockLoop = vi.mocked(runCompletionLoop);

afterEach(() => {
  mockLoop.mockReset();
});

const defaultProviderConfig = {
  baseUrl: "http://localhost",
  model: "test-model",
  apiKey: "key",
  maxTokens: 1024,
  contextWindow: 8192,
};

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    renderInteractive: () => Promise.reject(new Error("not implemented")),
    reportProgress: () => {},
    permissions: {},
    signal: new AbortController().signal,
    depth: 0,
    providerConfig: defaultProviderConfig,
    ...overrides,
  };
}

function getAgentTool() {
  const tool = getTool("agent");
  if (!tool) throw new Error("agent tool not registered");
  return tool;
}

describe("agent tool", () => {
  it("is registered as non-interactive", () => {
    const tool = getAgentTool();
    expect(tool.interactive).toBe(false);
  });

  it("returns final content from the completion loop", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "Here are my findings",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    const result = await tool.execute(
      JSON.stringify({ prompt: "find all config files" }),
      makeContext(),
    );

    expect(result).toBe("Here are my findings");
  });

  it("returns fallback message when sub-agent produces no output", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    const result = await tool.execute(
      JSON.stringify({ prompt: "do something" }),
      makeContext(),
    );

    expect(result).toBe("(sub-agent produced no output)");
  });

  it("passes provider config to the completion loop", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    await tool.execute(JSON.stringify({ prompt: "test" }), makeContext());

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    expect(opts.baseUrl).toBe("http://localhost");
    expect(opts.model).toBe("test-model");
    expect(opts.apiKey).toBe("key");
    expect(opts.maxTokens).toBe(1024);
    expect(opts.contextWindow).toBe(8192);
  });

  it("passes the prompt as the initial user message", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    await tool.execute(
      JSON.stringify({ prompt: "search for bugs" }),
      makeContext(),
    );

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    expect(opts.initialMessages).toEqual([
      { role: "user", content: "search for bugs" },
    ]);
  });

  it("includes sub-agent guidance in system message", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    await tool.execute(JSON.stringify({ prompt: "test" }), makeContext());

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    expect(opts.systemMessage).toContain("You are a sub-agent");
  });

  it("passes only allowed tools to the sub-agent", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    await tool.execute(
      JSON.stringify({ prompt: "test" }),
      makeContext({ depth: 0 }),
    );

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    const toolNames = opts.tools?.map((t) => t.function.name) ?? [];

    // Should include read-only tools but not write tools
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("glob");
    expect(toolNames).toContain("grep");
    expect(toolNames).not.toContain("edit_file");
    expect(toolNames).not.toContain("write_file");
    expect(toolNames).not.toContain("run_command");
  });

  it("excludes agent tool at max depth", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    // depth 0 spawns sub-agent at depth 1 = MAX_AGENT_DEPTH
    await tool.execute(
      JSON.stringify({ prompt: "test" }),
      makeContext({ depth: 0 }),
    );

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    const toolNames = opts.tools?.map((t) => t.function.name) ?? [];

    // depth 0 + 1 = 1 which is MAX_AGENT_DEPTH, so agent should be excluded
    expect(toolNames).not.toContain("agent");
  });

  it("passes abort signal through to the completion loop", async () => {
    const controller = new AbortController();

    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    await tool.execute(
      JSON.stringify({ prompt: "test" }),
      makeContext({ signal: controller.signal }),
    );

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    expect(opts.signal).toBe(controller.signal);
  });

  it("returns error string on non-abort errors", async () => {
    mockLoop.mockRejectedValueOnce(new Error("connection failed"));

    const tool = getAgentTool();
    const result = await tool.execute(
      JSON.stringify({ prompt: "test" }),
      makeContext(),
    );

    expect(result).toBe("Sub-agent error: connection failed");
  });

  it("re-throws abort errors", async () => {
    mockLoop.mockRejectedValueOnce(new DOMException("aborted", "AbortError"));

    const tool = getAgentTool();
    await expect(
      tool.execute(JSON.stringify({ prompt: "test" }), makeContext()),
    ).rejects.toThrow("aborted");
  });

  it("increments depth for the sub-agent tool context", async () => {
    mockLoop.mockResolvedValueOnce({
      content: "done",
      messages: [],
      aborted: false,
    });

    const tool = getAgentTool();
    await tool.execute(
      JSON.stringify({ prompt: "test" }),
      makeContext({ depth: 0 }),
    );

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    // The toolContext passed to the loop should have depth 1
    expect(opts.toolContext.depth).toBe(1);
  });
});
