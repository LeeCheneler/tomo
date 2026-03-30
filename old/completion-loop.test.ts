import { afterEach, describe, expect, it, vi } from "vitest";
import { runCompletionLoop } from "./completion-loop";
import type { ChatMessage, TokenUsage, ToolCall } from "./provider/client";
import type { ToolContext } from "./tools";

/** Creates a mock CompletionStream that yields the given tokens and returns the given tool calls. */
function mockCompletion(
  tokens: string[],
  toolCalls: ToolCall[] = [],
  usage: TokenUsage | null = null,
) {
  return {
    content: (async function* () {
      for (const t of tokens) yield t;
    })(),
    getToolCalls: () => toolCalls,
    getUsage: () => usage,
  };
}

const defaultProviderConfig = {
  baseUrl: "http://localhost",
  model: "test-model",
  apiKey: undefined,
  maxTokens: 1024,
  contextWindow: 8192,
};

const noopToolContext: ToolContext = {
  renderInteractive: () => Promise.reject(new Error("not implemented")),
  reportProgress: () => {},
  permissions: {},
  signal: new AbortController().signal,
  depth: 0,
  providerConfig: defaultProviderConfig,

  allowedCommands: [],
};

function baseOptions(
  overrides: Partial<Parameters<typeof runCompletionLoop>[0]> = {},
) {
  return {
    baseUrl: "http://localhost",
    model: "test-model",
    systemMessage: null,
    initialMessages: [] as ChatMessage[],
    toolContext: noopToolContext,
    maxTokens: 1024,
    contextWindow: 8192,
    signal: new AbortController().signal,
    ...overrides,
  };
}

vi.mock("./provider/client", () => ({
  streamChatCompletion: vi.fn(),
}));

vi.mock("./hooks/tool-execution", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("./hooks/tool-execution")>();
  return {
    ...original,
    executeToolCalls: vi.fn(),
  };
});

// Dynamically import mocked modules so we can control them per-test.
const { streamChatCompletion } = await import("./provider/client");
const { executeToolCalls, ToolDismissedError } = await import(
  "./hooks/tool-execution"
);

const mockStream = vi.mocked(streamChatCompletion);
const mockExecuteTools = vi.mocked(executeToolCalls);

afterEach(() => {
  mockStream.mockReset();
  mockExecuteTools.mockReset();
});

describe("runCompletionLoop", () => {
  it("returns content when model responds with no tool calls", async () => {
    mockStream.mockResolvedValueOnce(mockCompletion(["Hello", " world"]));

    const result = await runCompletionLoop(baseOptions());

    expect(result.content).toBe("Hello world");
    expect(result.aborted).toBe(false);
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      role: "assistant",
      content: "Hello world",
    });
  });

  it("calls onContent with accumulated tokens", async () => {
    mockStream.mockResolvedValueOnce(mockCompletion(["a", "b", "c"]));
    const onContent = vi.fn();

    await runCompletionLoop(baseOptions({ onContent }));

    expect(onContent).toHaveBeenCalledWith("a");
    expect(onContent).toHaveBeenCalledWith("ab");
    expect(onContent).toHaveBeenCalledWith("abc");
  });

  it("calls onMessage for each new message", async () => {
    mockStream.mockResolvedValueOnce(mockCompletion(["done"]));
    const onMessage = vi.fn();

    await runCompletionLoop(baseOptions({ onMessage }));

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({
      role: "assistant",
      content: "done",
    });
  });

  it("calls onUsage when usage is reported", async () => {
    const usage: TokenUsage = { promptTokens: 100, completionTokens: 50 };
    mockStream.mockResolvedValueOnce(mockCompletion(["ok"], [], usage));
    const onUsage = vi.fn();

    await runCompletionLoop(baseOptions({ onUsage }));

    expect(onUsage).toHaveBeenCalledWith(usage);
  });

  it("executes tool calls and loops until content-only response", async () => {
    const toolCall: ToolCall = {
      id: "tc_1",
      type: "function",
      function: { name: "test_tool", arguments: "{}" },
    };

    // First call: tool call
    mockStream.mockResolvedValueOnce(mockCompletion([], [toolCall]));
    // Second call: content only
    mockStream.mockResolvedValueOnce(mockCompletion(["final answer"]));

    mockExecuteTools.mockResolvedValueOnce([
      {
        id: "msg_1",
        role: "tool",
        content: "tool result",
        tool_call_id: "tc_1",
      },
    ]);

    const onToolActive = vi.fn();

    const result = await runCompletionLoop(baseOptions({ onToolActive }));

    expect(result.content).toBe("final answer");
    // assistant (tool_calls) + tool result + assistant (final)
    expect(result.messages).toHaveLength(3);
    expect(result.messages[0]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [toolCall],
    });
    expect(result.messages[1]).toEqual({
      role: "tool",
      content: "tool result",
      tool_call_id: "tc_1",
    });
    expect(result.messages[2]).toEqual({
      role: "assistant",
      content: "final answer",
    });
    expect(onToolActive).toHaveBeenCalledWith(true);
    expect(onToolActive).toHaveBeenCalledWith(false);
  });

  it("nudges up to 3 times on empty responses then stops", async () => {
    // 3 empty responses + 1 final empty (gives up)
    for (let i = 0; i < 4; i++) {
      mockStream.mockResolvedValueOnce(mockCompletion([]));
    }

    const result = await runCompletionLoop(baseOptions());

    expect(result.content).toBe("");
    expect(result.messages).toHaveLength(0);
    // 1 initial + 3 retries = 4 calls total
    expect(mockStream).toHaveBeenCalledTimes(4);
  });

  it("preserves partial content on abort", async () => {
    const controller = new AbortController();

    mockStream.mockResolvedValueOnce({
      content: (async function* () {
        yield "partial";
        controller.abort();
        throw new DOMException("aborted", "AbortError");
      })(),
      getToolCalls: () => [],
      getUsage: () => null,
    });

    const onMessage = vi.fn();
    const result = await runCompletionLoop(
      baseOptions({ signal: controller.signal, onMessage }),
    );

    expect(result.aborted).toBe(true);
    expect(result.content).toBe("partial");
    // Partial message should be added
    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]).toEqual({
      role: "assistant",
      content: "partial",
    });
    expect(onMessage).toHaveBeenCalledWith({
      role: "assistant",
      content: "partial",
    });
  });

  it("terminates with system note on ToolDismissedError", async () => {
    const toolCall: ToolCall = {
      id: "tc_1",
      type: "function",
      function: { name: "ask_user", arguments: "{}" },
    };

    mockStream.mockResolvedValueOnce(mockCompletion([], [toolCall]));
    mockExecuteTools.mockRejectedValueOnce(new ToolDismissedError());

    const result = await runCompletionLoop(baseOptions());

    // assistant (tool_calls) + system (dismissed)
    expect(result.messages).toHaveLength(2);
    expect(result.messages[1]).toEqual({
      role: "system",
      content: "Question dismissed",
    });
  });

  it("strips ANSI escape codes from tool results sent to the LLM", async () => {
    const toolCall: ToolCall = {
      id: "tc_1",
      type: "function",
      function: { name: "run_command", arguments: "{}" },
    };

    mockStream.mockResolvedValueOnce(mockCompletion([], [toolCall]));
    mockStream.mockResolvedValueOnce(mockCompletion(["done"]));

    mockExecuteTools.mockResolvedValueOnce([
      {
        id: "msg_1",
        role: "tool",
        content: "\x1b[1m\x1b[33mRun Command\x1b[39m\x1b[22m\nExit code: 0",
        tool_call_id: "tc_1",
      },
    ]);

    const result = await runCompletionLoop(baseOptions());

    const toolMsg = result.messages.find((m) => m.role === "tool");
    expect(toolMsg?.content).toBe("Run Command\nExit code: 0");
    // biome-ignore lint/suspicious/noControlCharactersInRegex: asserting ANSI codes are absent
    expect(toolMsg?.content).not.toMatch(/\x1b/);
  });

  it("preserves ANSI in onMessage for display while stripping for API", async () => {
    const toolCall: ToolCall = {
      id: "tc_1",
      type: "function",
      function: { name: "run_command", arguments: "{}" },
    };

    mockStream.mockResolvedValueOnce(mockCompletion([], [toolCall]));
    mockStream.mockResolvedValueOnce(mockCompletion(["done"]));

    const ansiContent =
      "\x1b[1m\x1b[33mRun Command\x1b[39m\x1b[22m\nExit code: 0";
    mockExecuteTools.mockResolvedValueOnce([
      {
        id: "msg_1",
        role: "tool",
        content: ansiContent,
        tool_call_id: "tc_1",
      },
    ]);

    const onMessage = vi.fn();
    const result = await runCompletionLoop(baseOptions({ onMessage }));

    // onMessage should receive ANSI-rich content for display
    const displayCall = onMessage.mock.calls.find(
      (args) => args[0].role === "tool",
    );
    expect(displayCall).toBeDefined();
    expect(displayCall?.[0].content).toBe(ansiContent);

    // result.messages (API) should be stripped
    const apiMsg = result.messages.find((m) => m.role === "tool");
    expect(apiMsg?.content).toBe("Run Command\nExit code: 0");
  });

  it("propagates non-abort errors", async () => {
    mockStream.mockRejectedValueOnce(new Error("connection failed"));

    await expect(runCompletionLoop(baseOptions())).rejects.toThrow(
      "connection failed",
    );
  });

  it("includes initial messages in returned history", async () => {
    const initial: ChatMessage[] = [{ role: "user", content: "hello" }];
    mockStream.mockResolvedValueOnce(mockCompletion(["hi"]));

    const result = await runCompletionLoop(
      baseOptions({ initialMessages: initial }),
    );

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({ role: "user", content: "hello" });
    expect(result.messages[1]).toEqual({ role: "assistant", content: "hi" });
  });
});
