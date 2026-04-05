import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { ChatList, LiveAssistantMessage } from "./chat-list";
import type { ChatMessage } from "./message";

describe("ChatList", () => {
  it("renders nothing when messages is empty and no header", () => {
    const { lastFrame } = renderInk(<ChatList messages={[]} />);
    expect(lastFrame()).toBe("");
  });

  it("renders header when provided with no messages", () => {
    const { lastFrame } = renderInk(
      <ChatList messages={[]} header={<Text>MY HEADER</Text>} />,
    );
    expect(lastFrame()).toContain("MY HEADER");
  });

  it("renders header before messages", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello" },
    ];
    const { lastFrame } = renderInk(
      <ChatList messages={messages} header={<Text>MY HEADER</Text>} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("MY HEADER");
    expect(frame).toContain("hello");
    // Header should appear before the message.
    const headerIndex = frame.indexOf("MY HEADER");
    const messageIndex = frame.indexOf("hello");
    expect(headerIndex).toBeLessThan(messageIndex);
  });

  it("renders a user message", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello world" },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    expect(lastFrame()).toContain("hello world");
  });

  it("renders multiple user messages", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "first" },
      { id: "2", role: "user", content: "second" },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("first");
    expect(frame).toContain("second");
  });

  it("renders a command message with command name and result", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "command", command: "ping", result: "pong" },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("/ping");
    expect(frame).toContain("pong");
  });

  it("renders an assistant message", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "Hello, how can I help?" },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    expect(lastFrame()).toContain("Hello, how can I help?");
  });

  it("renders assistant messages with markdown formatting", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "- item one\n- item two" },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("•");
    expect(frame).toContain("item one");
    expect(frame).toContain("item two");
  });

  it("renders an interrupted message", () => {
    const messages: ChatMessage[] = [{ id: "1", role: "interrupted" }];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    expect(lastFrame()).toContain("Interrupted");
  });

  it("renders an error message", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "error", content: "Something went wrong" },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    expect(lastFrame()).toContain("Something went wrong");
  });

  it("renders a tool-call message with display name and args in parens", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-call",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            name: "read_file",
            displayName: "Read File",
            arguments: '{"path":"./foo.ts"}',
          },
        ],
      },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("⚙ Read File");
    expect(frame).toContain("(path: ./foo.ts)");
  });

  it("renders tool-call with no args when arguments are a non-object JSON value", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-call",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            name: "test",
            displayName: "Test",
            arguments: '"just a string"',
          },
        ],
      },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("⚙");
    expect(frame).toContain("Test");
    expect(frame).not.toContain("just a string");
  });

  it("renders tool-call with no args when arguments are invalid JSON", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-call",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            name: "broken",
            displayName: "Broken",
            arguments: "not json",
          },
        ],
      },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("⚙");
    expect(frame).toContain("Broken");
  });

  it("renders a tool-result message with output", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-result",
        toolCallId: "call_1",
        toolName: "read_file",
        output: "file contents here",
      },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("file contents here");
  });

  it("truncates tool-result output to 5 lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-result",
        toolCallId: "call_1",
        toolName: "read_file",
        output: lines.join("\n"),
      },
    ];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("line 1");
    expect(frame).toContain("line 5");
    expect(frame).toContain("…");
    expect(frame).not.toContain("line 6");
  });

  it("skips unknown message roles", () => {
    const messages = [
      { id: "1", role: "unknown", content: "should not render" },
    ] as unknown as ChatMessage[];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    expect(lastFrame()).toBe("");
  });
});

describe("LiveAssistantMessage", () => {
  it("renders content when provided", () => {
    const { lastFrame } = renderInk(
      <LiveAssistantMessage content="streaming text" />,
    );
    expect(lastFrame()).toContain("streaming text");
  });

  it("renders streaming content with markdown formatting", () => {
    const { lastFrame } = renderInk(
      <LiveAssistantMessage content="- item one\n- item two" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("•");
    expect(frame).toContain("item one");
  });

  it("renders nothing when content is empty", () => {
    const { lastFrame } = renderInk(<LiveAssistantMessage content="" />);
    expect(lastFrame()).toBe("");
  });
});
