import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../provider/client";
import { countMessageTokens, countTokens } from "./tokenizer";

describe("countTokens", () => {
  it("returns a positive count for non-empty text", () => {
    expect(countTokens("hello world")).toBeGreaterThan(0);
  });

  it("returns zero for an empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("returns more tokens for longer text", () => {
    const short = countTokens("hi");
    const long = countTokens("this is a much longer sentence with many words");
    expect(long).toBeGreaterThan(short);
  });
});

describe("countMessageTokens", () => {
  it("counts a simple user message", () => {
    const msg: ChatMessage = { role: "user", content: "hello" };
    const tokens = countMessageTokens(msg);
    // Content tokens + overhead
    expect(tokens).toBeGreaterThan(countTokens("hello"));
  });

  it("counts a system message", () => {
    const msg: ChatMessage = { role: "system", content: "You are helpful." };
    expect(countMessageTokens(msg)).toBeGreaterThan(0);
  });

  it("counts an assistant message with tool calls", () => {
    const msg: ChatMessage = {
      role: "assistant",
      content: "Let me search",
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "grep", arguments: '{"pattern":"foo"}' },
        },
      ],
    };
    const withoutTools: ChatMessage = {
      role: "assistant",
      content: "Let me search",
    };
    expect(countMessageTokens(msg)).toBeGreaterThan(
      countMessageTokens(withoutTools),
    );
  });

  it("counts a tool result message", () => {
    const msg: ChatMessage = {
      role: "tool",
      content: "file.ts:10:match",
      tool_call_id: "call_1",
    };
    expect(countMessageTokens(msg)).toBeGreaterThan(0);
  });

  it("counts content part arrays", () => {
    const msg: ChatMessage = {
      role: "user",
      content: [
        { type: "text", text: "hello" },
        { type: "text", text: "world" },
      ],
    };
    expect(countMessageTokens(msg)).toBeGreaterThan(0);
  });
});
