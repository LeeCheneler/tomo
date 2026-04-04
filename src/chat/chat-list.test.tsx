import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { ChatList, LiveAssistantMessage } from "./chat-list";
import type { ChatMessage } from "./message";

describe("ChatList", () => {
  it("renders nothing when messages is empty", () => {
    const { lastFrame } = renderInk(<ChatList messages={[]} />);
    expect(lastFrame()).toBe("");
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

  it("renders nothing when content is empty", () => {
    const { lastFrame } = renderInk(<LiveAssistantMessage content="" />);
    expect(lastFrame()).toBe("");
  });
});
