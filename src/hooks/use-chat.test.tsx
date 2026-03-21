import { render } from "ink-testing-library";
import { Text } from "ink";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  parse: () => null,
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

describe("useChat message queuing", () => {
  beforeEach(() => {
    streams.length = 0;
    vi.mocked(streamChatCompletion).mockImplementation(async (options) =>
      createDeferredStream(options.signal),
    );
  });

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
