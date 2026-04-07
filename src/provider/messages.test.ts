import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../chat/message";
import { buildProviderMessages } from "./messages";

describe("buildProviderMessages", () => {
  it("prepends the system prompt at index 0", () => {
    const result = buildProviderMessages([], "You are helpful.");

    expect(result).toEqual([{ role: "system", content: "You are helpful." }]);
  });

  it("maps user and assistant messages to provider format", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello" },
      { id: "2", role: "assistant", content: "hi there" },
      { id: "3", role: "user", content: "thanks" },
    ];

    const result = buildProviderMessages(messages, "system prompt");

    expect(result).toEqual([
      { role: "system", content: "system prompt" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi there" },
      { role: "user", content: "thanks" },
    ]);
  });

  it("skips command, error, and interrupted messages", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello" },
      { id: "2", role: "command", command: "ping", result: "pong" },
      { id: "3", role: "error", content: "something broke" },
      { id: "4", role: "interrupted" },
      { id: "5", role: "assistant", content: "response" },
    ];

    const result = buildProviderMessages(messages, "sys");

    expect(result).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "hello" },
      { role: "assistant", content: "response" },
    ]);
  });

  it("maps tool-call messages to assistant with tool_calls", () => {
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
            arguments: '{"path":"foo.ts"}',
            summary: "foo.ts",
          },
        ],
      },
    ];

    const result = buildProviderMessages(messages, "sys");

    expect(result[1]).toEqual({
      role: "assistant",
      content: "",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "read_file", arguments: '{"path":"foo.ts"}' },
        },
      ],
    });
  });

  it("maps tool-result messages to tool role", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-result",
        toolCallId: "call_1",
        toolName: "read_file",
        output: "file contents here",
        status: "ok",
        format: "plain",
      },
    ];

    const result = buildProviderMessages(messages, "sys");

    expect(result[1]).toEqual({
      role: "tool",
      content: "file contents here",
      tool_call_id: "call_1",
    });
  });

  it("maps skill messages to user role", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "skill",
        skillName: "review",
        content: "<skill>prompt</skill>",
      },
    ];

    const result = buildProviderMessages(messages, "sys");

    expect(result[1]).toEqual({
      role: "user",
      content: "<skill>prompt</skill>",
    });
  });

  it("converts user messages with images to ContentPart array", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "user",
        content: "What is this?",
        images: [
          { name: "photo.png", dataUri: "data:image/png;base64,abc123" },
        ],
      },
    ];

    const result = buildProviderMessages(messages, "sys");

    expect(result[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "What is this?" },
        {
          type: "image_url",
          image_url: { url: "data:image/png;base64,abc123" },
        },
      ],
    });
  });

  it("converts user messages with multiple images", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "user",
        content: "Compare these",
        images: [
          { name: "a.png", dataUri: "data:image/png;base64,aaa" },
          { name: "b.jpg", dataUri: "data:image/jpeg;base64,bbb" },
        ],
      },
    ];

    const result = buildProviderMessages(messages, "sys");
    const content = result[1].content;
    expect(Array.isArray(content)).toBe(true);
    expect((content as unknown[]).length).toBe(3);
  });

  it("sends plain string for user messages without images", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "no images" },
    ];

    const result = buildProviderMessages(messages, "sys");
    expect(result[1]).toEqual({ role: "user", content: "no images" });
  });

  it("sends plain string for user messages with empty images array", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "empty array", images: [] },
    ];

    const result = buildProviderMessages(messages, "sys");
    expect(result[1]).toEqual({ role: "user", content: "empty array" });
  });

  it("strips ANSI codes from assistant messages", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "assistant",
        content: "\x1b[1mbold\x1b[0m and \x1b[31mred\x1b[0m text",
      },
    ];

    const result = buildProviderMessages(messages, "sys");

    expect(result[1]).toEqual({
      role: "assistant",
      content: "bold and red text",
    });
  });
});
