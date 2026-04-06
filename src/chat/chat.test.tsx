import { createElement, useEffect } from "react";
import { Text, useInput } from "ink";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CommandRegistry, TakeoverDone } from "../commands/registry";
import { createCommandRegistry } from "../commands/registry";
import { SESSIONS_DIR } from "../session/session";
import { z } from "zod";
import { createToolRegistry } from "../tools/registry";
import { ok } from "../tools/types";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { setupMsw, http, HttpResponse } from "../test-utils/msw";
import { useConfig } from "../config/hook";
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
  execFileSync: vi.fn(() => {
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

/** Default handler for Ollama context window requests. */
const ollamaShowHandler = http.post("http://localhost:11434/api/show", () =>
  HttpResponse.json({ model_info: { num_ctx: 8192 } }),
);

describe("Chat", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Empty tool registry for tests that don't need tools. */
  const emptyToolRegistry = createToolRegistry();

  /** Renders Chat with a fixed terminal width and optional commandRegistry. */
  function renderChat(commandRegistry?: CommandRegistry) {
    setColumns(COLUMNS);
    return renderInk(
      <Chat
        commandRegistry={commandRegistry}
        toolRegistry={emptyToolRegistry}
      />,
    );
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
    const mswServer = setupMsw(ollamaShowHandler);

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

    /** Renders Chat with a provider configured via config context. */
    function renderChatWithProvider(commandRegistry?: CommandRegistry) {
      setColumns(COLUMNS);
      return renderInk(
        <Chat
          commandRegistry={commandRegistry}
          toolRegistry={emptyToolRegistry}
        />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );
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

    it("does not duplicate interrupted message when config reloads after abort", async () => {
      /** Takeover component that reloads config on mount, exits on escape. */
      function ConfigReloader(props: { onDone: TakeoverDone }) {
        const { reload } = useConfig();
        useEffect(() => {
          reload();
        }, [reload]);
        useInput((_input, key) => {
          if (key.escape) props.onDone();
        });
        return createElement(Text, null, "RELOADER");
      }

      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "reload",
        description: "Reloads config",
        takeover: (onDone) => createElement(ConfigReloader, { onDone }),
      });

      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () => new Promise(() => {}),
        ),
      );

      const { stdin, lastFrame } = renderChatWithProvider(commandRegistry);
      await stdin.write("hi");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 50));

      // Abort the stream
      await stdin.write(keys.escape);
      await new Promise((r) => setTimeout(r, 50));

      const frameAfterAbort = lastFrame() ?? "";
      const countAfterAbort = frameAfterAbort.split("Interrupted").length - 1;
      expect(countAfterAbort).toBe(1);

      // Open takeover that reloads config (simulates toggling a permission)
      await stdin.write("/reload ");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 50));
      expect(lastFrame()).toContain("RELOADER");

      // Exit takeover
      await stdin.write(keys.escape);
      await new Promise((r) => setTimeout(r, 50));

      // Should still have exactly one "Interrupted" — no duplicates
      const frameAfterReload = lastFrame() ?? "";
      const countAfterReload = frameAfterReload.split("Interrupted").length - 1;
      expect(countAfterReload).toBe(1);
    });

    it("accepts new messages after abort without stale interrupted state", async () => {
      let requestCount = 0;

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", () => {
          requestCount++;
          if (requestCount === 1) {
            // First request: hang forever so the user can abort
            return new Promise(() => {});
          }
          return new HttpResponse(
            sseBody([{ choices: [{ delta: { content: "Second response" } }] }]),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("first");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 50));

      // Abort
      await stdin.write(keys.escape);
      await new Promise((r) => setTimeout(r, 50));
      expect(lastFrame()).toContain("Interrupted");

      // Send a new message — should get a normal response
      await stdin.write("second");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      const frame = lastFrame() ?? "";
      expect(frame).toContain("Second response");
      // Only the one "Interrupted" from the first abort
      const count = frame.split("Interrupted").length - 1;
      expect(count).toBe(1);
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

    it("handles empty completion without appending a message", async () => {
      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          () =>
            new HttpResponse("data: [DONE]\n\n", {
              headers: { "Content-Type": "text/event-stream" },
            }),
        ),
      );

      const { stdin, lastFrame } = renderChatWithProvider();
      await stdin.write("hi");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));
      const frame = lastFrame() ?? "";
      // User message is shown but no assistant response
      expect(frame).toContain("hi");
      expect(frame).not.toContain("assistant");
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

  describe("session persistence", () => {
    const mswServer = setupMsw(ollamaShowHandler);

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

    /** Returns parsed messages from the session file in the mock fs. */
    function getSessionMessages(
      fsState: ReturnType<typeof renderInk>["fsState"],
    ): unknown[] {
      const sessionFile = fsState
        .getPaths()
        .filter((p) => p.startsWith(SESSIONS_DIR))
        .sort()
        .pop();
      if (!sessionFile) return [];
      const content = fsState.getFile(sessionFile);
      if (!content) return [];
      return content
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
    }

    it("writes all message types to the session file", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });

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

      setColumns(COLUMNS);
      const { stdin, fsState } = renderInk(
        <Chat
          commandRegistry={commandRegistry}
          toolRegistry={emptyToolRegistry}
        />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );

      // User message + assistant response
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      // Command message
      await stdin.write("/ping ");
      await stdin.write(keys.enter);

      const messages = getSessionMessages(fsState);
      expect(messages).toHaveLength(3);
      expect(messages[0]).toMatchObject({ role: "user", content: "hello" });
      expect(messages[1]).toMatchObject({
        role: "assistant",
        content: "Hello from LLM",
      });
      expect(messages[2]).toMatchObject({
        role: "command",
        command: "ping",
        result: "pong",
      });

      // All messages are written to a single session file.
      const sessionFiles = fsState
        .getPaths()
        .filter((p) => p.startsWith(SESSIONS_DIR));
      expect(sessionFiles).toHaveLength(1);
    });

    it("resetSession clears messages and starts a new session file", async () => {
      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "reset",
        description: "Resets the session",
        handler: (context) => {
          context.resetSession();
          return "done";
        },
      });

      setColumns(COLUMNS);
      const { stdin, fsState } = renderInk(
        <Chat
          commandRegistry={commandRegistry}
          toolRegistry={emptyToolRegistry}
        />,
      );

      // Send a message so the first session file has content.
      await stdin.write("before reset");
      await stdin.write(keys.enter);

      // Invoke the command that calls resetSession.
      await stdin.write("/reset ");
      await stdin.write(keys.enter);

      // Send another message — should go to a new session file.
      await stdin.write("after reset");
      await stdin.write(keys.enter);

      // Two session files exist: one from before reset, one after.
      const sessionFiles = fsState
        .getPaths()
        .filter((p) => p.startsWith(SESSIONS_DIR))
        .sort();
      expect(sessionFiles).toHaveLength(2);

      // First session has the pre-reset user message.
      const firstContent = fsState.getFile(sessionFiles[0]) ?? "";
      const firstMessages = firstContent
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(firstMessages).toHaveLength(1);
      expect(firstMessages[0]).toMatchObject({
        role: "user",
        content: "before reset",
      });

      // Second session has the command result and post-reset message.
      const secondContent = fsState.getFile(sessionFiles[1]) ?? "";
      const secondMessages = secondContent
        .trimEnd()
        .split("\n")
        .map((line) => JSON.parse(line));
      expect(secondMessages).toHaveLength(2);
      expect(secondMessages[0]).toMatchObject({
        role: "command",
        command: "reset",
      });
      expect(secondMessages[1]).toMatchObject({
        role: "user",
        content: "after reset",
      });
    });

    it("loadSession replaces messages and redirects writes to the loaded file", async () => {
      // Pre-populate a session file to load.
      const loadPath = `${SESSIONS_DIR}/2026-01-01T00-00-00-000Z-load-test.jsonl`;
      const loadedMsg = JSON.stringify({
        id: "loaded-1",
        role: "user",
        content: "loaded message",
      });

      const commandRegistry = createCommandRegistry();
      commandRegistry.register({
        name: "load",
        description: "Loads a session",
        handler: (context) => {
          context.loadSession(loadPath);
          return "loaded";
        },
      });

      setColumns(COLUMNS);
      const { stdin, fsState } = renderInk(
        <Chat
          commandRegistry={commandRegistry}
          toolRegistry={emptyToolRegistry}
        />,
      );

      // Write the session file into the mock fs before invoking the command.
      fsState.getFile; // ensure fs is initialised
      // We need to write via the mock — use appendFile spy path
      const { writeFile: mockWrite } = await import("../utils/fs");
      mockWrite(loadPath, `${loadedMsg}\n`);

      // Invoke the command that calls loadSession.
      await stdin.write("/load ");
      await stdin.write(keys.enter);

      // Send a new message — should append to the loaded session file.
      await stdin.write("new message");
      await stdin.write(keys.enter);

      const content = fsState.getFile(loadPath) ?? "";
      const lines = content.trimEnd().split("\n");
      // Original loaded message + the load command result + the new user message.
      expect(lines).toHaveLength(3);
      expect(JSON.parse(lines[0])).toMatchObject({
        role: "user",
        content: "loaded message",
      });
      expect(JSON.parse(lines[1])).toMatchObject({
        role: "command",
        command: "load",
      });
      expect(JSON.parse(lines[2])).toMatchObject({
        role: "user",
        content: "new message",
      });
    });
  });

  describe("tool execution", () => {
    const mswServer = setupMsw(ollamaShowHandler);

    const PROVIDER = {
      name: "test-ollama",
      type: "ollama" as const,
      baseUrl: "http://localhost:11434",
    };

    /** Builds an SSE response body from data objects. */
    function sseBody(chunks: unknown[]): string {
      return (
        chunks.map((c) => `data: ${JSON.stringify(c)}`).join("\n\n") +
        "\n\ndata: [DONE]\n\n"
      );
    }

    it("executes tool calls and re-sends completion with results", async () => {
      let requestCount = 0;

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", async () => {
          requestCount++;
          if (requestCount === 1) {
            return new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: "call_1",
                            function: {
                              name: "test_tool",
                              arguments: "{}",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            );
          }
          return new HttpResponse(
            sseBody([
              { choices: [{ delta: { content: "Tool result was: hello" } }] },
            ]),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }),
      );

      const toolExecute = vi.fn(async () => ok("hello"));
      const toolRegistry = createToolRegistry();
      toolRegistry.register({
        name: "test_tool",
        displayName: "Test Tool",
        description: "A test tool",
        parameters: { type: "object", properties: {}, required: [] },
        argsSchema: z.object({}),
        formatCall: () => "",
        execute: toolExecute,
      });

      setColumns(COLUMNS);
      const { stdin, lastFrame } = renderInk(
        <Chat toolRegistry={toolRegistry} />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );

      await stdin.write("use the tool");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 200));

      // Loop completed: first request triggered tool, second sent results
      expect(requestCount).toBe(2);
      expect(toolExecute).toHaveBeenCalledOnce();
      expect(lastFrame()).toContain("Tool result was: hello");
    });

    it("shows ask prompt and returns user answer", async () => {
      let requestCount = 0;

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", async () => {
          requestCount++;
          if (requestCount === 1) {
            return new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: "call_1",
                            function: {
                              name: "ask_tool",
                              arguments:
                                '{"question":"Pick one","options":["A","B"]}',
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            );
          }
          return new HttpResponse(
            sseBody([{ choices: [{ delta: { content: "Got it" } }] }]),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }),
      );

      const toolRegistry = createToolRegistry();
      toolRegistry.register({
        name: "ask_tool",
        displayName: "Ask",
        description: "Asks a question",
        parameters: { type: "object", properties: {}, required: [] },
        argsSchema: z.object({
          question: z.string(),
          options: z.array(z.string()).optional(),
        }),
        formatCall: () => "",
        execute: async (_args, context) => {
          const parsed = _args as { question: string; options?: string[] };
          const answer = await context.ask(parsed.question, parsed.options);
          return ok(answer ?? "cancelled");
        },
      });

      setColumns(COLUMNS);
      const { stdin, lastFrame } = renderInk(
        <Chat toolRegistry={toolRegistry} />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );

      await stdin.write("ask me something");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      // Ask prompt should be visible with the question and options
      expect(lastFrame()).toContain("Pick one");
      expect(lastFrame()).toContain("A");
      expect(lastFrame()).toContain("B");

      // Select first option
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 200));

      expect(requestCount).toBe(2);
    });

    it("shows confirm prompt and proceeds on approval", async () => {
      let requestCount = 0;

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", async () => {
          requestCount++;
          if (requestCount === 1) {
            return new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: "call_1",
                            function: {
                              name: "confirm_tool",
                              arguments: "{}",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            );
          }
          return new HttpResponse(
            sseBody([{ choices: [{ delta: { content: "Approved result" } }] }]),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }),
      );

      const toolRegistry = createToolRegistry();
      toolRegistry.register({
        name: "confirm_tool",
        displayName: "Confirm Tool",
        description: "A tool that needs confirmation",
        parameters: { type: "object", properties: {}, required: [] },
        argsSchema: z.object({}),
        formatCall: () => "",
        execute: async (_args, context) => {
          const approved = await context.confirm("Allow this action?");
          return ok(approved ? "was approved" : "was denied");
        },
      });

      setColumns(COLUMNS);
      const { stdin, lastFrame } = renderInk(
        <Chat toolRegistry={toolRegistry} />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );

      await stdin.write("do the thing");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      // Confirm prompt should be visible
      expect(lastFrame()).toContain("Awaiting approval");
      expect(lastFrame()).toContain("Approve");
      expect(lastFrame()).toContain("Deny");

      // Approve
      await stdin.write("y");
      await new Promise((r) => setTimeout(r, 200));

      expect(requestCount).toBe(2);
      expect(lastFrame()).toContain("Approved result");
    });

    it("shows diff in confirm prompt when tool provides one", async () => {
      let requestCount = 0;

      mswServer.use(
        http.post("http://localhost:11434/v1/chat/completions", async () => {
          requestCount++;
          if (requestCount === 1) {
            return new HttpResponse(
              sseBody([
                {
                  choices: [
                    {
                      delta: {
                        tool_calls: [
                          {
                            index: 0,
                            id: "call_1",
                            function: {
                              name: "diff_tool",
                              arguments: "{}",
                            },
                          },
                        ],
                      },
                    },
                  ],
                },
              ]),
              { headers: { "Content-Type": "text/event-stream" } },
            );
          }
          return new HttpResponse(
            sseBody([{ choices: [{ delta: { content: "Done" } }] }]),
            { headers: { "Content-Type": "text/event-stream" } },
          );
        }),
      );

      const toolRegistry = createToolRegistry();
      toolRegistry.register({
        name: "diff_tool",
        displayName: "Diff Tool",
        description: "A tool that shows a diff on confirm",
        parameters: { type: "object", properties: {}, required: [] },
        argsSchema: z.object({}),
        formatCall: () => "",
        execute: async (_args, context) => {
          const approved = await context.confirm("Apply changes?", {
            diff: "-old line\n+new line",
          });
          return ok(approved ? "applied" : "skipped");
        },
      });

      setColumns(COLUMNS);
      const { stdin, lastFrame } = renderInk(
        <Chat toolRegistry={toolRegistry} />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );

      await stdin.write("do the thing");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      // Diff should be visible alongside the confirm prompt
      expect(lastFrame()).toContain("-old line");
      expect(lastFrame()).toContain("+new line");
      expect(lastFrame()).toContain("Awaiting approval");

      // Approve and verify completion
      await stdin.write("y");
      await new Promise((r) => setTimeout(r, 200));

      expect(requestCount).toBe(2);
    });

    it("shows confirm prompt and returns denied on rejection", async () => {
      let requestCount = 0;
      let secondRequestMessages: unknown[] = [];

      mswServer.use(
        http.post(
          "http://localhost:11434/v1/chat/completions",
          async (info) => {
            requestCount++;
            if (requestCount === 1) {
              return new HttpResponse(
                sseBody([
                  {
                    choices: [
                      {
                        delta: {
                          tool_calls: [
                            {
                              index: 0,
                              id: "call_1",
                              function: {
                                name: "confirm_tool",
                                arguments: "{}",
                              },
                            },
                          ],
                        },
                      },
                    ],
                  },
                ]),
                { headers: { "Content-Type": "text/event-stream" } },
              );
            }
            const body = (await info.request.json()) as {
              messages: unknown[];
            };
            secondRequestMessages = body.messages;
            return new HttpResponse(
              sseBody([{ choices: [{ delta: { content: "Denied result" } }] }]),
              { headers: { "Content-Type": "text/event-stream" } },
            );
          },
        ),
      );

      const toolRegistry = createToolRegistry();
      toolRegistry.register({
        name: "confirm_tool",
        displayName: "Confirm Tool",
        description: "A tool that needs confirmation",
        parameters: { type: "object", properties: {}, required: [] },
        argsSchema: z.object({}),
        formatCall: () => "",
        execute: async (_args, context) => {
          const approved = await context.confirm("Allow this action?");
          return ok(approved ? "was approved" : "was denied");
        },
      });

      setColumns(COLUMNS);
      const { stdin, lastFrame } = renderInk(
        <Chat toolRegistry={toolRegistry} />,
        {
          global: {
            providers: [PROVIDER],
            activeProvider: PROVIDER.name,
            activeModel: "llama3",
          },
        },
      );

      await stdin.write("do the thing");
      await stdin.write(keys.enter);
      await new Promise((r) => setTimeout(r, 100));

      // Deny
      await stdin.write("n");
      await new Promise((r) => setTimeout(r, 200));

      expect(requestCount).toBe(2);
      expect(lastFrame()).toContain("Denied result");

      // The denied result was sent to the LLM
      const toolResultMsg = secondRequestMessages.find(
        (m: unknown) => (m as { role: string }).role === "tool",
      );
      expect(toolResultMsg).toBeDefined();
      expect((toolResultMsg as { content: string }).content).toBe("was denied");
    });
  });
});
