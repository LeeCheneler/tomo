import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { ChatList } from "./chat-list";
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

  it("skips unknown message roles", () => {
    const messages = [
      { id: "1", role: "unknown", content: "should not render" },
    ] as unknown as ChatMessage[];
    const { lastFrame } = renderInk(<ChatList messages={messages} />);
    expect(lastFrame()).toBe("");
  });
});
