import { render } from "ink-testing-library";
import { Text } from "ink";
import { createElement } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatState } from "./hooks/use-chat";
import type { DisplayMessage } from "./components/message-list";

// Mock useChat to control the chat state returned to App.
const mockChatState: ChatState = {
  messages: [],
  streaming: false,
  streamingContent: "",
  error: null,
  activeCommand: null,
  activeModel: "test-model",
  activeProvider: {
    name: "test",
    type: "ollama",
    baseUrl: "http://localhost:11434",
  },
  tokenUsage: null,
  contextWindow: 8192,
  pendingMessage: null,
  toolActive: false,
  submit: vi.fn(),
  cancel: vi.fn(),
  cancelPending: vi.fn(),
  clearMessages: vi.fn(),
};

vi.mock("./hooks/use-chat", () => ({
  useChat: () => mockChatState,
}));

vi.mock("./config", () => ({
  loadConfig: () => ({
    activeProvider: "test",
    activeModel: "test-model",
    maxTokens: 8192,
    providers: [
      { name: "test", type: "ollama", baseUrl: "http://localhost:11434" },
    ],
  }),
  getProviderByName: () => ({
    name: "test",
    type: "ollama",
    baseUrl: "http://localhost:11434",
  }),
}));

vi.mock("./session", () => ({
  createSession: () => ({
    id: "s1",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    provider: "test",
    model: "test-model",
    messages: [],
  }),
}));

vi.mock("./instructions", () => ({
  loadInstructions: () => null,
}));

vi.mock("./tools", () => ({
  getAllTools: () => [],
  resolveToolAvailability: () => ({}),
}));

// Must import App after mocks are set up.
const { App } = await import("./app");

function resetChatState(overrides: Partial<ChatState> = {}) {
  Object.assign(mockChatState, {
    messages: [],
    streaming: false,
    streamingContent: "",
    error: null,
    activeCommand: null,
    activeModel: "test-model",
    tokenUsage: null,
    contextWindow: 8192,
    pendingMessage: null,
    toolActive: false,
    ...overrides,
  });
}

describe("App", () => {
  beforeEach(() => {
    resetChatState();
  });

  it("renders the header with model name", () => {
    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("友");
    expect(output).toContain("test-model");
  });

  it("renders the chat input prompt", () => {
    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain(">");
  });

  it("renders user and assistant messages", () => {
    const messages: DisplayMessage[] = [
      { id: "1", role: "user", content: "hello" },
      { id: "2", role: "assistant", content: "hi there" },
    ];
    resetChatState({ messages });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("hello");
    expect(output).toContain("hi there");
  });

  it("renders system messages", () => {
    const messages: DisplayMessage[] = [
      { id: "1", role: "system", content: "Session loaded" },
    ];
    resetChatState({ messages });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Session loaded");
  });

  it("renders error state", () => {
    resetChatState({ error: "connection refused" });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Error: connection refused");
  });

  it("renders streaming content as assistant message", () => {
    resetChatState({
      streaming: true,
      streamingContent: "partial response...",
    });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("partial response...");
  });

  it("renders streaming tool output dimmed", () => {
    resetChatState({
      streaming: true,
      streamingContent: "tool output",
      toolActive: true,
    });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("tool output");
  });

  it("renders thinking indicator when streaming with no content", () => {
    resetChatState({ streaming: true, streamingContent: "" });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    // ThinkingIndicator renders a spinner character
    expect(output).toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("does not render thinking indicator when activeCommand is set", () => {
    resetChatState({
      streaming: true,
      streamingContent: "",
      activeCommand: createElement(Text, null, "interactive prompt"),
    });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("interactive prompt");
    // Should not contain spinner
    expect(output).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });

  it("renders pending message indicator", () => {
    resetChatState({
      streaming: true,
      streamingContent: "working...",
      pendingMessage: "next question",
    });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("Queued:");
    expect(output).toContain("next question");
  });

  it("does not render pending message when null", () => {
    resetChatState({ pendingMessage: null });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).not.toContain("Queued:");
  });

  it("renders tool messages", () => {
    const messages: DisplayMessage[] = [
      {
        id: "1",
        role: "tool",
        content: "read_file\nfile contents here",
        tool_call_id: "tc1",
      },
    ];
    resetChatState({ messages });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    expect(output).toContain("file contents here");
  });

  it("hides streaming content when not streaming", () => {
    resetChatState({ streaming: false, streamingContent: "" });

    const { lastFrame } = render(<App onRestart={() => {}} />);
    const output = lastFrame() ?? "";
    // Should not contain spinner or any streaming indicators
    expect(output).not.toMatch(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/);
  });
});
