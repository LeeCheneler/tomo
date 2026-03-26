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

vi.mock("../config", async (importOriginal) => {
  const original = await importOriginal<typeof import("../config")>();
  return {
    ...original,
    loadConfig: vi.fn().mockReturnValue({
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
    }),
  };
});

// Import tools index to trigger all tool registrations.
await import("./index");

const { runCompletionLoop } = await import("../completion-loop");
const { loadConfig } = await import("../config");
const mockLoop = vi.mocked(runCompletionLoop);
const mockLoadConfig = vi.mocked(loadConfig);

afterEach(() => {
  mockLoop.mockReset();
  mockLoadConfig.mockReturnValue({
    activeProvider: "",
    activeModel: "",
    maxTokens: 8192,
    providers: [],
  });
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
    await tool.execute(
      JSON.stringify({ prompt: "test" }),
      makeContext({ depth: 0 }),
    );

    const opts = mockLoop.mock.calls[0][0] as CompletionLoopOptions;
    const toolNames = opts.tools?.map((t) => t.function.name) ?? [];

    // depth 0 + 1 = 1 which is default maxDepth, so agent should be excluded
    expect(toolNames).not.toContain("agent");
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

  it("re-throws abort errors from parent signal", async () => {
    const controller = new AbortController();
    mockLoop.mockImplementationOnce(async () => {
      controller.abort();
      throw new DOMException("aborted", "AbortError");
    });

    const tool = getAgentTool();
    await expect(
      tool.execute(
        JSON.stringify({ prompt: "test" }),
        makeContext({ signal: controller.signal }),
      ),
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
    expect(opts.toolContext.depth).toBe(1);
  });

  it("returns timeout message when agent exceeds timeout", async () => {
    vi.useFakeTimers();
    mockLoadConfig.mockReturnValue({
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      agents: { maxDepth: 1, maxConcurrent: 3, timeoutSeconds: 1, tools: [] },
    });

    mockLoop.mockImplementationOnce(async ({ signal }) => {
      await new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
      return { content: "", messages: [], aborted: true };
    });

    const tool = getAgentTool();
    const resultPromise = tool.execute(
      JSON.stringify({ prompt: "slow task" }),
      makeContext(),
    );

    await vi.advanceTimersByTimeAsync(1500);

    const result = await resultPromise;
    expect(result).toContain("timed out");

    vi.useRealTimers();
  });

  it("respects concurrency limit", async () => {
    mockLoadConfig.mockReturnValue({
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      agents: {
        maxDepth: 1,
        maxConcurrent: 1,
        timeoutSeconds: 120,
        tools: [],
      },
    });

    let running = 0;
    let maxRunning = 0;

    mockLoop.mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 10));
      running--;
      return { content: "done", messages: [], aborted: false };
    });

    const tool = getAgentTool();
    const ctx = makeContext();

    // Spawn 3 agents with concurrency limit of 1
    await Promise.all([
      tool.execute(JSON.stringify({ prompt: "a" }), ctx),
      tool.execute(JSON.stringify({ prompt: "b" }), ctx),
      tool.execute(JSON.stringify({ prompt: "c" }), ctx),
    ]);

    // Only 1 should have been running at a time
    expect(maxRunning).toBe(1);
  });

  it("per-call timeout is capped to global maximum", async () => {
    vi.useFakeTimers();
    mockLoadConfig.mockReturnValue({
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      agents: {
        maxDepth: 1,
        maxConcurrent: 3,
        timeoutSeconds: 2,
        tools: [],
      },
    });

    mockLoop.mockImplementationOnce(async ({ signal }) => {
      await new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
      return { content: "", messages: [], aborted: true };
    });

    const tool = getAgentTool();
    // Request 60s but global max is 2s — should be capped to 2s
    const resultPromise = tool.execute(
      JSON.stringify({ prompt: "test", timeout: 60 }),
      makeContext(),
    );

    await vi.advanceTimersByTimeAsync(2500);

    const result = await resultPromise;
    expect(result).toContain("timed out after 2s");

    vi.useRealTimers();
  });

  it("uses per-call timeout when under global maximum", async () => {
    vi.useFakeTimers();
    mockLoadConfig.mockReturnValue({
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      agents: {
        maxDepth: 1,
        maxConcurrent: 3,
        timeoutSeconds: 60,
        tools: [],
      },
    });

    mockLoop.mockImplementationOnce(async ({ signal }) => {
      await new Promise<never>((_, reject) => {
        signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
      return { content: "", messages: [], aborted: true };
    });

    const tool = getAgentTool();
    // Request 1s, global max is 60s — should use 1s
    const resultPromise = tool.execute(
      JSON.stringify({ prompt: "test", timeout: 1 }),
      makeContext(),
    );

    await vi.advanceTimersByTimeAsync(1500);

    const result = await resultPromise;
    expect(result).toContain("timed out after 1s");

    vi.useRealTimers();
  });
});
