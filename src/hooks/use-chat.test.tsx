import { render } from "ink-testing-library";
import { Text } from "ink";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parse, getCommand } from "../commands";
import { appendMessage } from "../session";
import { streamChatCompletion } from "../provider/client";
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
});
