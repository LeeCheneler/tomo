import { render } from "ink-testing-library";
import { Text } from "ink";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parse, getCommand } from "../commands";
import { appendMessage } from "../session";
import { streamChatCompletion } from "../provider/client";
import type { ToolCall } from "../provider/client";
import { getTool, getToolDefinitions } from "../tools";
import { type ChatState, useChat } from "./use-chat";

const flush = () => new Promise((r) => setTimeout(r, 50));

// --- Controllable stream for testing ---

interface DeferredStream {
  complete: () => void;
}

const streams: DeferredStream[] = [];

function createDeferredStream(signal?: AbortSignal) {
  let resolve!: () => void;
  const done = new Promise<void>((r) => {
    resolve = r;
  });

  async function* content(): AsyncGenerator<string> {
    yield "response";
    const abortPromise = signal
      ? new Promise<never>((_, reject) => {
          if (signal.aborted) {
            reject(new DOMException("aborted", "AbortError"));
            return;
          }
          signal.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        })
      : new Promise<never>(() => {});
    await Promise.race([done, abortPromise]);
  }

  const stream = { complete: resolve };
  streams.push(stream);

  return {
    content: content(),
    getUsage: () => ({ promptTokens: 10, completionTokens: 5 }),
    getToolCalls: () => [],
  };
}

// --- Mocks ---

vi.mock("../provider/client", () => ({
  fetchContextWindow: vi.fn().mockResolvedValue(8192),
  getDefaultContextWindow: () => 8192,
  streamChatCompletion: vi.fn(),
}));

vi.mock("../session", () => ({
  createSession: () => ({
    id: "s1",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    provider: "test",
    model: "test-model",
    messages: [],
  }),
  appendMessage: vi.fn(),
  loadSession: vi.fn(),
}));

vi.mock("../config", () => ({
  getMaxTokens: () => 8192,
  getProviderByName: vi.fn(),
  loadConfig: () => ({}),
  updateActiveModel: vi.fn(),
  updateActiveProvider: vi.fn(),
}));

vi.mock("../commands", () => ({
  parse: vi.fn(),
  getCommand: vi.fn(),
}));

vi.mock("../context/truncate", () => ({
  truncateMessages: (msgs: unknown[]) => msgs,
}));

vi.mock("../tools", () => ({
  getTool: vi.fn(),
  getToolDefinitions: vi.fn().mockReturnValue([]),
}));

const testProvider = {
  name: "test",
  type: "ollama" as const,
  baseUrl: "http://localhost:11434",
};

const testConfig = {
  activeProvider: "test",
  activeModel: "test-model",
  maxTokens: 8192,
  providers: [testProvider],
};

const testSession = {
  id: "s1",
  createdAt: "2025-01-01",
  updatedAt: "2025-01-01",
  provider: "test",
  model: "test-model",
  messages: [] as [],
};

let chat: ChatState;

function TestApp() {
  chat = useChat(testConfig, testProvider, "test-model", testSession, null);
  return <Text>{chat.streaming ? "streaming" : "idle"}</Text>;
}

function setupRegularMessages() {
  vi.mocked(parse).mockReturnValue(null);
  vi.mocked(streamChatCompletion).mockImplementation(async (options) =>
    createDeferredStream(options.signal),
  );
}

describe("useChat", () => {
  beforeEach(() => {
    streams.length = 0;
    vi.clearAllMocks();
  });

  describe("submit flow", () => {
    beforeEach(setupRegularMessages);

    it("adds user message and enters streaming state", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      expect(chat.streaming).toBe(true);
      expect(chat.messages).toHaveLength(1);
      expect(chat.messages[0].role).toBe("user");
      expect(chat.messages[0].content).toBe("hello");
    });

    it("adds assistant message after stream completes", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      streams[0].complete();
      await flush();

      expect(chat.streaming).toBe(false);
      expect(chat.messages).toHaveLength(2);
      expect(chat.messages[1].role).toBe("assistant");
      expect(chat.messages[1].content).toBe("response");
    });

    it("updates streamingContent during stream", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      expect(chat.streamingContent).toBe("response");
    });

    it("clears streamingContent after stream completes", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      streams[0].complete();
      await flush();

      expect(chat.streamingContent).toBe("");
    });

    it("sets token usage after stream completes", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      streams[0].complete();
      await flush();

      expect(chat.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
      });
    });
  });

  describe("session persistence", () => {
    beforeEach(setupRegularMessages);

    it("calls appendMessage for user message on submit", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      expect(vi.mocked(appendMessage)).toHaveBeenCalledWith(
        expect.objectContaining({ id: "s1" }),
        expect.objectContaining({ role: "user", content: "hello" }),
      );
    });

    it("calls appendMessage for assistant message after stream", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      streams[0].complete();
      await flush();

      expect(vi.mocked(appendMessage)).toHaveBeenCalledTimes(2);
      expect(vi.mocked(appendMessage)).toHaveBeenLastCalledWith(
        expect.objectContaining({ id: "s1" }),
        expect.objectContaining({ role: "assistant", content: "response" }),
      );
    });
  });

  describe("cancel / abort", () => {
    beforeEach(setupRegularMessages);

    it("cancel stops streaming and preserves partial content", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      expect(chat.streaming).toBe(true);

      chat.cancel();
      await flush();
      await flush();

      expect(chat.streaming).toBe(false);
      // Partial content ("response" was yielded before abort) is kept as a message
      expect(chat.messages.filter((m) => m.role === "assistant")).toHaveLength(
        1,
      );
    });
  });

  describe("error handling", () => {
    it("sets error state on stream failure", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(streamChatCompletion).mockRejectedValue(
        new Error("connection refused"),
      );

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      await flush();

      expect(chat.error).toBe("connection refused");
      expect(chat.streaming).toBe(false);
    });
  });

  describe("command dispatch", () => {
    it("shows error for unknown commands", async () => {
      vi.mocked(parse).mockReturnValue({ name: "bogus", args: "" });
      vi.mocked(getCommand).mockReturnValue(undefined);

      render(<TestApp />);
      await flush();

      chat.submit("/bogus");
      await flush();

      expect(chat.messages).toHaveLength(2);
      expect(chat.messages[0].role).toBe("user");
      expect(chat.messages[0].content).toBe("/bogus");
      expect(chat.messages[1].role).toBe("system");
      expect(chat.messages[1].content).toContain("Unknown command");
    });

    it("executes known commands and shows output", async () => {
      vi.mocked(parse).mockReturnValue({ name: "help", args: "" });
      vi.mocked(getCommand).mockReturnValue({
        name: "help",
        description: "List commands",
        execute: () => ({ output: "help output here" }),
      });

      render(<TestApp />);
      await flush();

      chat.submit("/help");
      await flush();

      expect(chat.messages).toHaveLength(2);
      expect(chat.messages[0].content).toBe("/help");
      expect(chat.messages[1].role).toBe("system");
      expect(chat.messages[1].content).toBe("help output here");
    });

    it("sets activeCommand for interactive commands", async () => {
      const element = <Text>interactive</Text>;
      vi.mocked(parse).mockReturnValue({ name: "session", args: "" });
      vi.mocked(getCommand).mockReturnValue({
        name: "session",
        description: "Load session",
        execute: () => ({ interactive: element }),
      });

      render(<TestApp />);
      await flush();

      chat.submit("/session");
      await flush();

      expect(chat.activeCommand).not.toBeNull();
      expect(chat.messages).toHaveLength(1);
      expect(chat.messages[0].content).toBe("/session");
    });
  });

  describe("message queuing", () => {
    beforeEach(setupRegularMessages);

    it("queues a message during streaming and sends it after", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("first");
      await flush();
      expect(chat.streaming).toBe(true);

      chat.submit("second");
      await flush();
      expect(streams).toHaveLength(1);
      expect(chat.pendingMessage).toBe("second");

      streams[0].complete();
      await flush();
      await flush();

      expect(streams).toHaveLength(2);

      streams[1].complete();
      await flush();

      expect(chat.messages).toHaveLength(4);
      expect(chat.messages[0].content).toBe("first");
      expect(chat.messages[1].role).toBe("assistant");
      expect(chat.messages[2].content).toBe("second");
      expect(chat.messages[3].role).toBe("assistant");
      expect(chat.pendingMessage).toBeNull();
    });

    it("last queued message wins when multiple are submitted", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("first");
      await flush();

      chat.submit("second");
      chat.submit("third");
      await flush();

      streams[0].complete();
      await flush();
      await flush();

      streams[1].complete();
      await flush();

      expect(chat.messages).toHaveLength(4);
      expect(chat.messages[2].content).toBe("third");
    });

    it("cancel clears the pending queue", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("first");
      await flush();

      chat.submit("second");
      await flush();

      chat.cancel();
      await flush();
      await flush();

      expect(streams).toHaveLength(1);
      expect(chat.streaming).toBe(false);
      expect(chat.pendingMessage).toBeNull();
      expect(chat.messages.filter((m) => m.role === "user")).toHaveLength(1);
    });
  });

  describe("tool execution loop", () => {
    function createToolCallStream(toolCalls: ToolCall[]) {
      async function* content(): AsyncGenerator<string> {
        // no content tokens for a tool-call response
      }
      return {
        content: content(),
        getUsage: () => ({ promptTokens: 10, completionTokens: 5 }),
        getToolCalls: () => toolCalls,
      };
    }

    function createContentStream(text: string) {
      async function* content(): AsyncGenerator<string> {
        yield text;
      }
      return {
        content: content(),
        getUsage: () => ({ promptTokens: 10, completionTokens: 5 }),
        getToolCalls: () => [],
      };
    }

    it("executes tool calls and re-calls provider until content response", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getTool).mockReturnValue({
        name: "ask",
        description: "Ask a question",
        parameters: {},
        execute: async () => "option A",
      });

      // First call returns tool call, second returns content
      vi.mocked(streamChatCompletion)
        .mockResolvedValueOnce(
          createToolCallStream([
            {
              id: "call-1",
              function: { name: "ask", arguments: '{"question":"pick"}' },
            },
          ]),
        )
        .mockResolvedValueOnce(createContentStream("Great, you chose A"));

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      await flush();

      expect(chat.streaming).toBe(false);
      expect(vi.mocked(streamChatCompletion)).toHaveBeenCalledTimes(2);

      // Messages: user, assistant (tool_calls), tool result, assistant (content)
      expect(chat.messages).toHaveLength(4);
      expect(chat.messages[0].role).toBe("user");
      expect(chat.messages[1].role).toBe("assistant");
      expect(chat.messages[2].role).toBe("tool");
      expect(chat.messages[2].content).toContain("option A");
      expect(chat.messages[3].role).toBe("assistant");
      expect(chat.messages[3].content).toBe("Great, you chose A");
    });

    it("returns error result for unknown tools", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getTool).mockReturnValue(undefined);

      vi.mocked(streamChatCompletion)
        .mockResolvedValueOnce(
          createToolCallStream([
            {
              id: "call-1",
              function: { name: "bogus", arguments: "{}" },
            },
          ]),
        )
        .mockResolvedValueOnce(
          createContentStream("Sorry, I don't have that tool"),
        );

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      await flush();

      expect(chat.messages[2].role).toBe("tool");
      expect(chat.messages[2].content).toContain('unknown tool "bogus"');
    });

    it("persists tool messages to the session", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getTool).mockReturnValue({
        name: "ask",
        description: "Ask",
        parameters: {},
        execute: async () => "result",
      });

      vi.mocked(streamChatCompletion)
        .mockResolvedValueOnce(
          createToolCallStream([
            {
              id: "call-1",
              function: { name: "ask", arguments: "{}" },
            },
          ]),
        )
        .mockResolvedValueOnce(createContentStream("done"));

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      await flush();

      // user + assistant(tool_calls) + tool result + assistant(content)
      expect(vi.mocked(appendMessage)).toHaveBeenCalledTimes(4);
      expect(vi.mocked(appendMessage)).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          role: "tool",
          content: expect.stringContaining("result"),
        }),
      );
    });

    it("handles tool execution errors gracefully", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getTool).mockReturnValue({
        name: "ask",
        description: "Ask",
        parameters: {},
        execute: async () => {
          throw new Error("tool failed");
        },
      });

      vi.mocked(streamChatCompletion)
        .mockResolvedValueOnce(
          createToolCallStream([
            {
              id: "call-1",
              function: { name: "ask", arguments: "{}" },
            },
          ]),
        )
        .mockResolvedValueOnce(createContentStream("ok"));

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      await flush();

      expect(chat.messages[2].role).toBe("tool");
      expect(chat.messages[2].content).toContain("tool failed");
    });

    it("stops the turn when a tool interaction is dismissed", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getTool).mockReturnValue({
        name: "ask",
        description: "Ask",
        parameters: {},
        execute: async (_args, context) =>
          context.renderInteractive((_onResult, onCancel) => {
            // Simulate user dismissing immediately via microtask
            Promise.resolve().then(onCancel);
            return <Text>mock</Text>;
          }),
      });

      vi.mocked(streamChatCompletion).mockResolvedValueOnce(
        createToolCallStream([
          {
            id: "call-1",
            function: { name: "ask", arguments: "{}" },
          },
        ]),
      );

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      // Need multiple flushes: stream completes → tool executes →
      // setTimeout fires → promise rejects → loop breaks → state updates
      for (let i = 0; i < 6; i++) await flush();

      expect(chat.streaming).toBe(false);
      // Provider should only be called once — no re-call after dismissal
      expect(vi.mocked(streamChatCompletion)).toHaveBeenCalledTimes(1);

      // Should have: user, assistant (tool_calls), system (dismissed)
      const systemMsgs = chat.messages.filter((m) => m.role === "system");
      expect(systemMsgs).toHaveLength(1);
      expect(systemMsgs[0].content).toBe("Question dismissed");
    });

    it("sends tool definitions with completion requests", async () => {
      vi.mocked(parse).mockReturnValue(null);
      const toolDefs = [
        {
          type: "function" as const,
          function: {
            name: "ask",
            description: "Ask a question",
            parameters: { type: "object", properties: {} },
          },
        },
      ];
      vi.mocked(getToolDefinitions).mockReturnValue(toolDefs);
      vi.mocked(streamChatCompletion).mockImplementation(async (options) =>
        createDeferredStream(options.signal),
      );

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      expect(vi.mocked(streamChatCompletion)).toHaveBeenCalledWith(
        expect.objectContaining({ tools: toolDefs }),
      );

      streams[0].complete();
      await flush();
    });

    it("retries with nudge when model returns empty response after tool calls", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getTool).mockReturnValue({
        name: "ask",
        description: "Ask",
        parameters: {},
        execute: async () => "result",
      });

      function createEmptyStream() {
        async function* content(): AsyncGenerator<string> {
          // yields nothing — simulates an empty model response
        }
        return {
          content: content(),
          getUsage: () => ({ promptTokens: 10, completionTokens: 5 }),
          getToolCalls: () => [],
        };
      }

      // Call 1: tool call, Call 2: empty response (triggers nudge),
      // Call 3: real content response
      vi.mocked(streamChatCompletion)
        .mockResolvedValueOnce(
          createToolCallStream([
            {
              id: "call-1",
              function: { name: "ask", arguments: "{}" },
            },
          ]),
        )
        .mockResolvedValueOnce(createEmptyStream())
        .mockResolvedValueOnce(createContentStream("recovered"));

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      await flush();
      await flush();

      expect(chat.streaming).toBe(false);
      // 3 calls: tool call, empty (nudge), content
      expect(vi.mocked(streamChatCompletion)).toHaveBeenCalledTimes(3);

      // Nudge message should have been sent in the 3rd call but NOT persisted
      const lastCallMessages =
        vi.mocked(streamChatCompletion).mock.calls[2][0].messages;
      const nudge = lastCallMessages.find(
        (m: { content: string }) =>
          typeof m.content === "string" &&
          m.content.includes("previous response was empty"),
      );
      expect(nudge).toBeDefined();

      // Nudge should NOT appear in the displayed messages
      const allContent = chat.messages.map((m) => m.content).join(" ");
      expect(allContent).not.toContain("previous response was empty");

      // Final assistant message should be present
      const lastMsg = chat.messages[chat.messages.length - 1];
      expect(lastMsg.role).toBe("assistant");
      expect(lastMsg.content).toBe("recovered");
    });

    it("gives up after max empty response retries", async () => {
      vi.mocked(parse).mockReturnValue(null);

      function createEmptyStream() {
        async function* content(): AsyncGenerator<string> {
          // empty
        }
        return {
          content: content(),
          getUsage: () => ({ promptTokens: 10, completionTokens: 5 }),
          getToolCalls: () => [],
        };
      }

      // All responses are empty — should stop after 3 retries + 1 original = 4 calls
      vi.mocked(streamChatCompletion)
        .mockResolvedValueOnce(createEmptyStream())
        .mockResolvedValueOnce(createEmptyStream())
        .mockResolvedValueOnce(createEmptyStream())
        .mockResolvedValueOnce(createEmptyStream());

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      for (let i = 0; i < 8; i++) await flush();

      expect(chat.streaming).toBe(false);
      // 1 original + 3 retries = 4 calls
      expect(vi.mocked(streamChatCompletion)).toHaveBeenCalledTimes(4);
    });

    it("does not send tools key when no tools are registered", async () => {
      vi.mocked(parse).mockReturnValue(null);
      vi.mocked(getToolDefinitions).mockReturnValue([]);
      vi.mocked(streamChatCompletion).mockImplementation(async (options) =>
        createDeferredStream(options.signal),
      );

      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();

      const callArgs = vi.mocked(streamChatCompletion).mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("tools");

      streams[0].complete();
      await flush();
    });
  });

  describe("/new command", () => {
    beforeEach(setupRegularMessages);

    it("resets token usage when clearing messages", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      streams[0].complete();
      await flush();

      // Token usage should be set after first message
      expect(chat.tokenUsage).toEqual({
        promptTokens: 10,
        completionTokens: 5,
      });

      // Simulate /new command which calls clearMessages
      chat.clearMessages();
      await flush();

      // tokenUsage should be reset after /new
      expect(chat.tokenUsage).toBeNull();
    });

    it("clears token usage on clearMessages", async () => {
      render(<TestApp />);
      await flush();

      chat.submit("hello");
      await flush();
      streams[0].complete();
      await flush();

      expect(chat.tokenUsage).not.toBeNull();

      chat.clearMessages();
      await flush();

      expect(chat.tokenUsage).toBeNull();
      expect(chat.messages).toEqual([]);
    });
  });
});
