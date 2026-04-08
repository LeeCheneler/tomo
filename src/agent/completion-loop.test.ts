import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type {
  CompletionStream,
  ProviderClient,
  ToolCall,
} from "../provider/client";
import { mockToolContext } from "../test-utils/stub-context";
import { createToolRegistry } from "../tools/registry";
import { ok } from "../tools/types";
import { runCompletionLoop } from "./completion-loop";

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
function mockStream(
  content: string[],
  toolCalls: ToolCall[] = [],
): CompletionStream {
  return {
    content: tokens(content),
    getUsage: () => null,
    getToolCalls: () => toolCalls,
  };
}

/** Creates a mock ProviderClient. */
function mockClient(
  streamFn: ProviderClient["streamCompletion"],
): ProviderClient {
  return {
    fetchModels: vi.fn(async () => []),
    fetchContextWindow: vi.fn(async () => 8192),
    streamCompletion: vi.fn(streamFn),
  };
}

/** Creates a minimal tool call. */
function stubToolCall(name: string, args: string, id?: string): ToolCall {
  return {
    id: id ?? `call_${name}`,
    type: "function",
    function: { name, arguments: args },
  };
}

/** Shared base options for tests. */
function baseOptions() {
  return {
    model: "test-model",
    contextWindow: 8192,
    systemPrompt: "You are a test agent.",
    initialMessages: [{ role: "user" as const, content: "hello" }],
    toolRegistry: createToolRegistry(),
    toolContext: mockToolContext(),
    signal: new AbortController().signal,
  };
}

describe("runCompletionLoop", () => {
  it("returns content from a simple completion with no tool calls", async () => {
    const client = mockClient(async () => mockStream(["Hello", " world"]));

    const result = await runCompletionLoop({
      ...baseOptions(),
      client,
    });

    expect(result.content).toBe("Hello world");
  });

  it("executes tool calls and loops back for a second completion", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "greet",
      displayName: "Greet",
      description: "Says hello",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("hello from tool"),
    });

    let callCount = 0;
    const client = mockClient(async () => {
      callCount++;
      if (callCount === 1) {
        return mockStream(["thinking"], [stubToolCall("greet", "{}")]);
      }
      return mockStream(["final answer"]);
    });

    const result = await runCompletionLoop({
      ...baseOptions(),
      client,
      toolRegistry: registry,
      tools: registry.getDefinitions(),
    });

    expect(result.content).toBe("final answer");
    expect(client.streamCompletion).toHaveBeenCalledTimes(2);
  });

  it("nudges the model on empty response", async () => {
    let callCount = 0;
    const client = mockClient(async () => {
      callCount++;
      if (callCount === 1) {
        return mockStream([]);
      }
      return mockStream(["recovered"]);
    });

    const result = await runCompletionLoop({
      ...baseOptions(),
      client,
    });

    expect(result.content).toBe("recovered");
    expect(client.streamCompletion).toHaveBeenCalledTimes(2);
  });

  it("gives up after max empty retries", async () => {
    const client = mockClient(async () => mockStream([]));

    const result = await runCompletionLoop({
      ...baseOptions(),
      client,
    });

    // 1 initial + 3 nudge retries = 4 calls
    expect(client.streamCompletion).toHaveBeenCalledTimes(4);
    expect(result.content).toBe("");
  });

  it("throws on abort during streaming", async () => {
    const controller = new AbortController();
    const client = mockClient(async () => ({
      content: {
        async *[Symbol.asyncIterator]() {
          yield "partial";
          controller.abort();
          yield " should not reach";
        },
      },
      getUsage: () => null,
      getToolCalls: () => [],
    }));

    await expect(
      runCompletionLoop({
        ...baseOptions(),
        client,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("throws on abort before streaming starts", async () => {
    const controller = new AbortController();
    controller.abort();

    const client = mockClient(async () => mockStream(["should not reach"]));

    await expect(
      runCompletionLoop({
        ...baseOptions(),
        client,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("calls onContent with accumulated content during streaming", async () => {
    const onContent = vi.fn();
    const client = mockClient(async () => mockStream(["Hello", " world"]));

    await runCompletionLoop({
      ...baseOptions(),
      client,
      onContent,
    });

    expect(onContent).toHaveBeenCalledWith("Hello");
    expect(onContent).toHaveBeenCalledWith("Hello world");
  });

  it("does not call onContent when not provided", async () => {
    const client = mockClient(async () => mockStream(["ok"]));

    // Should not throw — onContent is optional.
    const result = await runCompletionLoop({
      ...baseOptions(),
      client,
    });

    expect(result.content).toBe("ok");
  });

  it("feeds tool results back in provider format", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "echo",
      displayName: "Echo",
      description: "Echoes input",
      parameters: {
        type: "object",
        properties: { text: { type: "string" } },
      },
      argsSchema: z.object({ text: z.string() }),
      formatCall: (args) => String(args.text ?? ""),
      execute: async (args) => {
        const parsed = z.object({ text: z.string() }).parse(args);
        return ok(`echo: ${parsed.text}`);
      },
    });

    let callCount = 0;
    const capturedMessages: unknown[] = [];
    const client = mockClient(async (opts) => {
      callCount++;
      capturedMessages.push([...opts.messages]);
      if (callCount === 1) {
        return mockStream([""], [stubToolCall("echo", '{"text":"hi"}')]);
      }
      return mockStream(["done"]);
    });

    await runCompletionLoop({
      ...baseOptions(),
      client,
      toolRegistry: registry,
      tools: registry.getDefinitions(),
    });

    // Second call should include the tool result in provider format
    const secondCallMessages = capturedMessages[1] as Array<{
      role: string;
      content: string;
      tool_call_id?: string;
    }>;
    const toolResultMsg = secondCallMessages.find((m) => m.role === "tool");
    expect(toolResultMsg).toBeDefined();
    expect(toolResultMsg?.content).toBe("echo: hi");
    expect(toolResultMsg?.tool_call_id).toBe("call_echo");
  });

  it("passes system prompt as the first message", async () => {
    const capturedMessages: unknown[] = [];
    const client = mockClient(async (opts) => {
      capturedMessages.push([...opts.messages]);
      return mockStream(["ok"]);
    });

    await runCompletionLoop({
      ...baseOptions(),
      client,
      systemPrompt: "Be helpful.",
    });

    const messages = capturedMessages[0] as Array<{
      role: string;
      content: string;
    }>;
    expect(messages[0]).toEqual({ role: "system", content: "Be helpful." });
  });

  it("resets empty retry counter after successful tool calls", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "ping",
      displayName: "Ping",
      description: "pings",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("pong"),
    });

    let callCount = 0;
    const client = mockClient(async () => {
      callCount++;
      if (callCount === 1) return mockStream([]);
      if (callCount === 2) {
        return mockStream([""], [stubToolCall("ping", "{}")]);
      }
      if (callCount === 3) return mockStream([]);
      return mockStream(["finally"]);
    });

    const result = await runCompletionLoop({
      ...baseOptions(),
      client,
      toolRegistry: registry,
      tools: registry.getDefinitions(),
    });

    expect(result.content).toBe("finally");
    expect(client.streamCompletion).toHaveBeenCalledTimes(4);
  });

  it("reports tool invocations via onContent", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "read_file",
      displayName: "Read File",
      description: "reads",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({ path: z.string() }),
      formatCall: (args) => String(args.path ?? ""),
      execute: async () => ok("content"),
    });

    let callCount = 0;
    const client = mockClient(async () => {
      callCount++;
      if (callCount === 1) {
        return mockStream(
          [""],
          [stubToolCall("read_file", '{"path":"src/foo.ts"}')],
        );
      }
      return mockStream(["done"]);
    });

    const onContent = vi.fn();
    await runCompletionLoop({
      ...baseOptions(),
      client,
      toolRegistry: registry,
      tools: registry.getDefinitions(),
      onContent,
    });

    // Should have been called with the tool invocation line.
    expect(onContent).toHaveBeenCalledWith("[tool] Read File src/foo.ts");
  });

  it("accumulates tool invocations across multiple loop iterations", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "glob",
      displayName: "Glob",
      description: "globs",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({ pattern: z.string() }),
      formatCall: (args) => String(args.pattern ?? ""),
      execute: async () => ok("files"),
    });
    registry.register({
      name: "read_file",
      displayName: "Read File",
      description: "reads",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({ path: z.string() }),
      formatCall: (args) => String(args.path ?? ""),
      execute: async () => ok("content"),
    });

    let callCount = 0;
    const client = mockClient(async () => {
      callCount++;
      if (callCount === 1) {
        return mockStream(
          [""],
          [stubToolCall("glob", '{"pattern":"**/*.ts"}')],
        );
      }
      if (callCount === 2) {
        return mockStream(
          [""],
          [stubToolCall("read_file", '{"path":"src/a.ts"}')],
        );
      }
      return mockStream(["summary"]);
    });

    const onContent = vi.fn();
    await runCompletionLoop({
      ...baseOptions(),
      client,
      toolRegistry: registry,
      tools: registry.getDefinitions(),
      onContent,
    });

    // After second tool call, log should have both entries.
    expect(onContent).toHaveBeenCalledWith(
      "[tool] Glob **/*.ts\n[tool] Read File src/a.ts",
    );
  });

  it("appends streaming text after accumulated tool call log", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "grep",
      displayName: "Grep",
      description: "searches",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({ pattern: z.string() }),
      formatCall: (args) => String(args.pattern ?? ""),
      execute: async () => ok("matches"),
    });

    let callCount = 0;
    const client = mockClient(async () => {
      callCount++;
      if (callCount === 1) {
        return mockStream([""], [stubToolCall("grep", '{"pattern":"TODO"}')]);
      }
      return mockStream(["Found", " results"]);
    });

    const onContent = vi.fn();
    await runCompletionLoop({
      ...baseOptions(),
      client,
      toolRegistry: registry,
      tools: registry.getDefinitions(),
      onContent,
    });

    // Final streaming content should include the tool log prefix.
    expect(onContent).toHaveBeenCalledWith("[tool] Grep TODO\nFound");
    expect(onContent).toHaveBeenCalledWith("[tool] Grep TODO\nFound results");
  });
});
