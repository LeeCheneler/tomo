import { createElement } from "react";
import { Text, useInput } from "ink";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandRegistry, TakeoverDone } from "../commands/registry";
import { createCommandRegistry } from "../commands/registry";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { setupMsw, http, HttpResponse } from "../test-utils/msw";
import { Chat } from "./chat";

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  platform: () => "linux",
  release: () => "6.1.0",
  arch: () => "x64",
  userInfo: () => ({ username: "testuser" }),
  homedir: () => "/mock-home",
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => {
    throw new Error("not a git repo");
  }),
}));

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("Chat", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders Chat with a fixed terminal width and optional commandRegistry. */
  function renderChat(commandRegistry?: CommandRegistry) {
    setColumns(COLUMNS);
    return renderInk(<Chat commandRegistry={commandRegistry} />);
  }

  describe("input mode", () => {
    it("renders ChatInput by default", () => {
      const { lastFrame } = renderChat();
      expect(lastFrame()).toContain("❯");
    });

    it("does not switch to history on up arrow when history is empty", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯");
    });
  });

  describe("message submission", () => {
    it("clears input and shows message in list after submit", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      // Message persists in the chat list above the input.
      expect(frame).toContain("hello");
      // Input is cleared — only the prompt marker remains in the input area.
      expect(frame).toContain("❯");
    });

    it("shows up history instruction after first message", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("up");
      expect(frame).toContain("history");
    });
  });

  describe("command execution", () => {
    it("executes a registered command and shows result", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("/ping ");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/ping");
      expect(frame).toContain("pong");
    });

    it("shows error for unknown command", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("/nope ");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/nope");
      expect(frame).toContain("Unknown command");
    });

    it("does not add command to input history", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("/ping ");
      await stdin.write(keys.enter);
      // Up arrow should not enter history mode since commands aren't in input history.
      // The input area should still show an empty prompt (not a history entry).
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("submit");
      expect(frame).toContain("command");
    });
  });

  describe("autocomplete", () => {
    it("shows autocomplete list when typing a command", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/ping");
      expect(frame).toContain("Responds with pong");
    });

    it("navigates autocomplete with up/down and shows navigate instruction", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "aaa",
        description: "First",
        handler: () => "a",
      });
      commandRegistry.register({
        name: "bbb",
        description: "Second",
        handler: () => "b",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      // Down should move selection.
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("bbb");
    });

    it("fills input with selected command on enter and dismisses autocomplete", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("/");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("/ping");
      // Autocomplete should be dismissed (space appended).
      expect(frame).not.toContain("Responds with pong");
    });

    it("hides autocomplete after space", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("/ping");
      await stdin.write(keys.space);
      expect(lastFrame()).not.toContain("Responds with pong");
    });

    it("does not show autocomplete for regular messages", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const { stdin, lastFrame } = renderChat(commandRegistry);
      await stdin.write("hello");
      expect(lastFrame()).not.toContain("Responds with pong");
    });
  });

  describe("takeover", () => {
    /** Stub takeover component that renders text and exits on escape. */
    function StubTakeover(props: { onDone: TakeoverDone }) {
      useInput((_input, key) => {
        if (key.escape) {
          props.onDone("Stub result");
        }
      });
      return createElement(Text, null, "STUB_TAKEOVER");
    }

    /** Creates a registry with a takeover command that renders StubTakeover. */
    function createTakeoverRegistry(): CommandRegistry {
      const registry = createCommandRegistry();
      registry.register({
        name: "test",
        description: "Test takeover",
        takeover: (onDone) => createElement(StubTakeover, { onDone }),
      });
      return registry;
    }

    it("switches to takeover screen on takeover command", async () => {
      const { stdin, lastFrame } = renderChat(createTakeoverRegistry());
      await stdin.write("/test ");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("STUB_TAKEOVER");
      // ChatInput is not rendered
      expect(frame).not.toContain("command");
    });

    it("returns to input mode when takeover calls onDone", async () => {
      const { stdin, lastFrame } = renderChat(createTakeoverRegistry());
      await stdin.write("/test ");
      await stdin.write(keys.enter);
      // Escape triggers StubTakeover's onDone
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      // Result message appears in chat list with command name
      expect(frame).toContain("/test");
      expect(frame).toContain("Stub result");
    });

    it("does not append a message when takeover calls onDone with no result", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "silent",
        description: "Silent takeover",
        takeover: (onDone) => {
          // Immediately done with no result
          setTimeout(() => onDone(), 0);
          return createElement(Text, null, "SILENT");
        },
      });
      const { stdin, lastFrame } = renderChat(registry);
      await stdin.write("/silent ");
      await stdin.write(keys.enter);
      // Wait for the setTimeout to fire
      await new Promise((r) => setTimeout(r, 50));
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      // No command message in the list (only the input prompt)
      expect(frame).not.toContain("/silent");
    });

    it("shows takeover in autocomplete", async () => {
      const { stdin, lastFrame } = renderChat(createTakeoverRegistry());
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("test");
      expect(frame).toContain("Test takeover");
    });
  });

  describe("history navigation", () => {
    it("switches to history mode on up arrow after submitting a message", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("hello");
    });

    it("returns to input mode with draft on exit from history", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("sent");
      await stdin.write(keys.enter);
      // Type a draft, then enter history (two ups: first moves cursor to start, second triggers onUp).
      await stdin.write("my draft");
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Exit history via escape — draft should be restored.
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("my draft");
    });

    it("loads selected entry into input replacing draft", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("sent");
      await stdin.write(keys.enter);
      // Type a draft, then enter history.
      await stdin.write("my draft");
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Select entry with enter — replaces draft.
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("sent");
      expect(frame).not.toContain("my draft");
    });

    it("restores draft on exit via down arrow past last entry", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("sent");
      await stdin.write(keys.enter);
      // Type a draft, then enter history.
      await stdin.write("my draft");
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Exit via down arrow — draft should be restored.
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("my draft");
    });
  });

  describe("completion", () => {
    const mswServer = setupMsw();

    /** Builds an SSE response body from data objects. */
    function sseBody(chunks: unknown[]): string {
      return (
        chunks.map((c) => `data: ${JSON.stringify(c)}`).join("\n\n") +
        "\n\ndata: [DONE]\n\n"
      );
    }

    const PROVIDER = {
      name: "test-ollama",
      type: "ollama" as const,
      baseUrl: "http://localhost:11434",
    };

    /** Renders Chat with a provider configured. */
    function renderChatWithProvider() {
      setColumns(COLUMNS);
      return renderInk(<Chat provider={PROVIDER} model="llama3" />, {
        global: { providers: [PROVIDER] },
      });
    }

    it("shows live streaming content below message list", async () => {
      const cleanup: { resolve: (() => void) | null } = { resolve: null };

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", () => {
          const body = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"content":"streaming..."}}]}\n\n',
                ),
              );
              cleanup.resolve = () => {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              };
            },
          });
          return new HttpResponse(body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        }),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("hi");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 50));

      // Should show live streaming content and loading indicator
      expect(lastFrame()).toContain("streaming...");
      expect(lastFrame()).toContain("⠋");

      cleanup.resolve?.();
    });

    it("shows interrupted message when user aborts stream", async () => {
      const cleanup: { resolve: (() => void) | null } = { resolve: null };

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", () => {
          const body = new ReadableStream({
            start(controller) {
              const encoder = new TextEncoder();
              controller.enqueue(
                encoder.encode(
                  'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
                ),
              );
              cleanup.resolve = () => {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
              };
            },
          });
          return new HttpResponse(body, {
            headers: { "Content-Type": "text/event-stream" },
          });
        }),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("hi");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 50));

      // Abort with escape
      await stdin.write(keys.escape);
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() ?? "";
      expect(frame).toContain("partial");
      expect(frame).toContain("Interrupted");

      cleanup.resolve?.();
    });

    it("shows interrupted message when aborted before any content", async () => {
      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () => new Promise(() => {}),
        ),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("hi");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 50));

      await stdin.write(keys.escape);
      await new Promise((r) => setTimeout(r, 50));

      const frame = lastFrame() ?? "";
      expect(frame).toContain("Interrupted");
      expect(frame).not.toContain("assistant");
    });

    it("sends user message to LLM and renders assistant response", async () => {
      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse(
              sseBody([
                { choices: [{ delta: { content: "Hello from LLM" } }] },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            ),
        ),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("hi there");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));
      const frame = lastFrame() ?? "";
      expect(frame).toContain("hi there");
      expect(frame).toContain("Hello from LLM");
    });

    it("shows error message on completion failure", async () => {
      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () => new HttpResponse(null, { status: 500 }),
        ),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("hi");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));
      expect(lastFrame()).toContain("500");
    });

    it("includes assistant messages in subsequent requests", async () => {
      let requestCount = 0;
      let lastMessages: unknown[] = [];

      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          async (info) => {
            requestCount++;
            const body = (await info.request.json()) as {
              messages: unknown[];
            };
            lastMessages = body.messages;
            return new HttpResponse(
              sseBody([
                {
                  choices: [{ delta: { content: `Response ${requestCount}` } }],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            );
          },
        ),
      );

      const { stdin } = renderChatWithProvider();

      // First message
      await stdin.write("first");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      // Second message — should include the assistant response in history
      await stdin.write("second");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      expect(requestCount).toBe(2);
      // Second request should have: system prompt, user "first", assistant "Response 1", user "second"
      expect(lastMessages[0]).toHaveProperty("role", "system");
      expect(lastMessages.slice(1)).toEqual([
        { role: "user", content: "first" },
        { role: "assistant", content: "Response 1" },
        { role: "user", content: "second" },
      ]);
    });
  });
});
