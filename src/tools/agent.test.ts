import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { loadConfig } from "../config/file";
import type { CompletionStream, ProviderClient } from "../provider/client";
import { createOpenAICompatibleClient } from "../provider/openai-compatible";
import { mockToolContext } from "../test-utils/stub-context";
import { createToolRegistry } from "./registry";
import { ok } from "./types";
import { createAgentTool } from "./agent";

vi.mock("../config/file", () => ({
  loadConfig: vi.fn(() => ({
    agents: {
      maxDepth: 1,
      maxConcurrent: 3,
      maxTimeoutSeconds: 300,
      tools: ["read_file", "glob", "grep"],
    },
    providers: [],
    activeProvider: null,
    activeModel: null,
    permissions: { cwdReadFile: true },
    allowedCommands: [],
    mcp: { connections: {} },
    skillSets: { sources: [] },
    tools: {
      agent: { enabled: true },
      ask: { enabled: true },
      editFile: { enabled: true },
      glob: { enabled: true },
      grep: { enabled: true },
      readFile: { enabled: true },
      runCommand: { enabled: true },
      skill: { enabled: true },
      webSearch: { enabled: false },
      writeFile: { enabled: true },
    },
  })),
}));

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  platform: () => "linux",
  release: () => "6.1.0",
  arch: () => "x64",
  userInfo: () => ({ username: "testuser" }),
}));

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(() => {
    throw new Error("not a git repo");
  }),
}));

/** Creates an async iterable that yields the given tokens. */
function tokens(values: string[]): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const v of values) {
        yield v;
      }
    },
  };
}

/** Creates a mock CompletionStream. */
function mockStream(content: string[]): CompletionStream {
  return {
    content: tokens(content),
    getUsage: () => null,
    getToolCalls: () => [],
  };
}

/** Creates a mock ProviderClient that returns the given content. */
function mockClient(content: string[]): ProviderClient {
  return {
    fetchModels: vi.fn(async () => []),
    fetchContextWindow: vi.fn(async () => 8192),
    streamCompletion: vi.fn(async () => mockStream(content)),
  };
}

vi.mock("../provider/openai-compatible", () => ({
  createOpenAICompatibleClient: vi.fn(() => mockClient(["agent result"])),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createAgentTool", () => {
  it("returns a tool with the correct name and displayName", () => {
    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    expect(tool.name).toBe("agent");
    expect(tool.displayName).toBe("Agent");
  });

  it("formatCall returns the agent name", () => {
    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    expect(tool.formatCall({ name: "auth-review", prompt: "check auth" })).toBe(
      "auth-review",
    );
  });

  it("requires name and prompt parameters", () => {
    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    expect(tool.parameters).toEqual(
      expect.objectContaining({
        required: ["name", "prompt"],
      }),
    );
  });

  it("executes successfully and returns sub-agent content", async () => {
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(
      mockClient(["research findings"]),
    );

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    const context = mockToolContext();

    const result = await tool.execute(
      { name: "test-agent", prompt: "find something" },
      context,
    );

    expect(result.status).toBe("ok");
    expect(result.output).toBe("research findings");
  });

  it("returns fallback message when sub-agent produces no output", async () => {
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(mockClient([]));

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);

    const result = await tool.execute(
      { name: "empty-agent", prompt: "do nothing" },
      mockToolContext(),
    );

    expect(result.status).toBe("ok");
    expect(result.output).toBe("(sub-agent produced no output)");
  });

  it("streams content via onProgress", async () => {
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(
      mockClient(["streaming", " content"]),
    );

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    const onProgress = vi.fn();

    await tool.execute(
      { name: "streaming-agent", prompt: "stream it" },
      mockToolContext({ onProgress }),
    );

    expect(onProgress).toHaveBeenCalledWith("streaming");
    expect(onProgress).toHaveBeenCalledWith("streaming content");
  });

  it("returns error on timeout", async () => {
    const hangingClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(
        (opts: { signal?: AbortSignal }) =>
          new Promise<CompletionStream>((_resolve, reject) => {
            opts.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(hangingClient);

    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        maxDepth: 1,
        maxConcurrent: 3,
        maxTimeoutSeconds: 1,
        tools: ["read_file"],
      },
    } as unknown as ReturnType<typeof loadConfig>);

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);

    const result = await tool.execute(
      { name: "slow-agent", prompt: "take forever", timeout: 1 },
      mockToolContext(),
    );

    expect(result.status).toBe("error");
    expect(result.output).toContain("timed out");
    expect(result.output).toContain("slow-agent");
  });

  it("propagates parent abort as a thrown error", async () => {
    const parentController = new AbortController();
    const hangingClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(
        (opts: { signal?: AbortSignal }) =>
          new Promise<CompletionStream>((_resolve, reject) => {
            opts.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      ),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(hangingClient);

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    const context = mockToolContext({ signal: parentController.signal });

    const promise = tool.execute(
      { name: "doomed-agent", prompt: "will be cancelled" },
      context,
    );

    parentController.abort();
    await expect(promise).rejects.toThrow();
  });

  it("builds sub-agent tool registry from config allowlist", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        maxDepth: 1,
        maxConcurrent: 3,
        maxTimeoutSeconds: 300,
        tools: ["read_file", "glob", "grep"],
      },
    } as unknown as ReturnType<typeof loadConfig>);

    let capturedTools: unknown;
    const capturingClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(async (opts) => {
        capturedTools = opts.tools;
        return mockStream(["done"]);
      }),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(capturingClient);

    const registry = createToolRegistry();
    registry.register({
      name: "read_file",
      displayName: "Read File",
      description: "reads files",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("content"),
    });
    registry.register({
      name: "write_file",
      displayName: "Write File",
      description: "writes files",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("written"),
    });

    const tool = createAgentTool(registry);
    await tool.execute(
      { name: "scoped-agent", prompt: "check files" },
      mockToolContext(),
    );

    const toolDefs = capturedTools as Array<{ function: { name: string } }>;
    const toolNames = toolDefs.map((t) => t.function.name);
    expect(toolNames).toContain("read_file");
    expect(toolNames).not.toContain("write_file");
    expect(toolNames).not.toContain("agent");
  });

  it("auto-includes MCP tools in sub-agent registry regardless of allowlist", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        maxDepth: 1,
        maxConcurrent: 3,
        maxTimeoutSeconds: 300,
        tools: ["read_file"],
      },
    } as unknown as ReturnType<typeof loadConfig>);

    let capturedTools: unknown;
    const capturingClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(async (opts) => {
        capturedTools = opts.tools;
        return mockStream(["done"]);
      }),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(capturingClient);

    const registry = createToolRegistry();
    registry.register({
      name: "read_file",
      displayName: "Read File",
      description: "reads files",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("content"),
    });
    registry.register({
      name: "mcp__mock__get_time",
      displayName: "mock/get_time",
      description: "Returns the time",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("12:00"),
    });

    const tool = createAgentTool(registry);
    await tool.execute(
      { name: "scoped-agent", prompt: "check time" },
      mockToolContext(),
    );

    const toolDefs = capturedTools as Array<{ function: { name: string } }>;
    const toolNames = toolDefs.map((t) => t.function.name);
    expect(toolNames).toContain("read_file");
    expect(toolNames).toContain("mcp__mock__get_time");
  });

  it("includes agent tool in sub-agent registry when below max depth", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        maxDepth: 2,
        maxConcurrent: 3,
        maxTimeoutSeconds: 300,
        tools: ["read_file"],
      },
    } as unknown as ReturnType<typeof loadConfig>);

    let capturedTools: unknown;
    const capturingClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(async (opts) => {
        capturedTools = opts.tools;
        return mockStream(["done"]);
      }),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(capturingClient);

    const registry = createToolRegistry();
    registry.register({
      name: "read_file",
      displayName: "Read File",
      description: "reads",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("content"),
    });
    const agentTool = createAgentTool(registry);
    registry.register(agentTool);

    await agentTool.execute(
      { name: "nested-agent", prompt: "go deeper" },
      mockToolContext({ depth: 0 }),
    );

    const toolDefs = capturedTools as Array<{ function: { name: string } }>;
    const toolNames = toolDefs.map((t) => t.function.name);
    expect(toolNames).toContain("agent");
  });

  it("wraps sub-agent confirm calls with agent name label", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        maxDepth: 1,
        maxConcurrent: 3,
        maxTimeoutSeconds: 300,
        tools: ["confirming_tool"],
      },
    } as unknown as ReturnType<typeof loadConfig>);

    // The sub-agent's first response triggers a tool call, second returns content.
    let streamCount = 0;
    const subClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(async () => {
        streamCount++;
        if (streamCount === 1) {
          return {
            content: tokens([""]),
            getUsage: () => null,
            getToolCalls: () => [
              {
                id: "call_1",
                type: "function" as const,
                function: { name: "confirming_tool", arguments: "{}" },
              },
            ],
          };
        }
        return mockStream(["done"]);
      }),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(subClient);

    const parentConfirm = vi.fn(async () => true);
    const registry = createToolRegistry();
    registry.register({
      name: "confirming_tool",
      displayName: "Confirming",
      description: "needs confirm",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async (_args, ctx) => {
        await ctx.confirm("Allow?", { label: "Run Command" });
        await ctx.confirm("Proceed?");
        return ok("confirmed");
      },
    });

    const tool = createAgentTool(registry);
    await tool.execute(
      { name: "my-agent", prompt: "do something" },
      mockToolContext({ confirm: parentConfirm }),
    );

    // The wrapped confirm should inject the agent name.
    expect(parentConfirm).toHaveBeenCalledTimes(2);
    expect(parentConfirm).toHaveBeenCalledWith("Allow?", {
      label: "Agent my-agent: Run Command",
    });
    // Second call has no label — falls back to message.
    expect(parentConfirm).toHaveBeenCalledWith("Proceed?", {
      label: "Agent my-agent: Proceed?",
    });
  });

  it("returns error for non-abort exceptions", async () => {
    const failingClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(async () => {
        throw new Error("network failure");
      }),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(failingClient);

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);

    const result = await tool.execute(
      { name: "failing-agent", prompt: "will fail" },
      mockToolContext(),
    );

    expect(result.status).toBe("error");
    expect(result.output).toContain("network failure");
    expect(result.output).toContain("failing-agent");
  });

  it("queues agents when concurrency limit is reached", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        maxDepth: 1,
        maxConcurrent: 1,
        maxTimeoutSeconds: 300,
        tools: [],
      },
    } as unknown as ReturnType<typeof loadConfig>);

    const order: string[] = [];
    // eslint-disable-next-line -- assigned inside async mock callback
    let resolveFirst: (() => void) | undefined;

    const delayClient: ProviderClient = {
      fetchModels: vi.fn(async () => []),
      fetchContextWindow: vi.fn(async () => 8192),
      streamCompletion: vi.fn(async () => {
        const callIndex = order.length;
        if (callIndex === 0) {
          order.push("first-start");
          await new Promise<void>((resolve) => {
            resolveFirst = resolve;
          });
          order.push("first-end");
        } else {
          order.push("second-start");
          order.push("second-end");
        }
        return mockStream(["done"]);
      }),
    };
    vi.mocked(createOpenAICompatibleClient).mockReturnValue(delayClient);

    const registry = createToolRegistry();
    const tool = createAgentTool(registry);
    const context = mockToolContext();

    const firstPromise = tool.execute(
      { name: "first", prompt: "go first" },
      context,
    );
    const secondPromise = tool.execute(
      { name: "second", prompt: "go second" },
      context,
    );

    await new Promise((r) => setTimeout(r, 50));
    expect(order).toEqual(["first-start"]);

    if (resolveFirst) resolveFirst();
    await new Promise((r) => setTimeout(r, 50));

    const [r1, r2] = await Promise.all([firstPromise, secondPromise]);
    expect(r1.status).toBe("ok");
    expect(r2.status).toBe("ok");
    expect(order).toEqual([
      "first-start",
      "first-end",
      "second-start",
      "second-end",
    ]);
  });
});
