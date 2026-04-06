import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../provider/client";
import { truncateMessages } from "./truncate";

// Mock the tokenizer so tests are deterministic and don't depend on the
// actual encoder. Each "word" = 1 token, plus 4 overhead per message.
vi.mock("./tokenizer", () => ({
  countMessageTokens: (msg: ChatMessage) => {
    const content =
      typeof msg.content === "string"
        ? msg.content
        : msg.content
            .filter(
              (p): p is { type: "text"; text: string } => p.type === "text",
            )
            .map((p) => p.text)
            .join(" ");
    // 1 token per word + 4 overhead
    return (content.split(/\s+/).filter(Boolean).length || 0) + 4;
  },
  countTokens: (text: string) => text.split(/\s+/).filter(Boolean).length,
}));

/** Helper to create a chat message. */
function msg(
  role: "user" | "assistant" | "system",
  content: string,
): ChatMessage {
  return { role, content } as ChatMessage;
}

describe("truncateMessages", () => {
  it("returns messages unchanged when under budget", () => {
    const messages = [
      msg("system", "sys"),
      msg("user", "hi"),
      msg("assistant", "hello"),
    ];
    // 3 messages × ~5 tokens each = ~15 tokens, budget is huge
    expect(truncateMessages(messages, 100000)).toEqual(messages);
  });

  it("returns empty array unchanged", () => {
    expect(truncateMessages([], 8192)).toEqual([]);
  });

  it("drops oldest non-system messages when over budget", () => {
    // Each message ≈ 5 tokens (1 word + 4 overhead)
    // Budget with 8192 context: floor(8192 * 0.95) - 4096 = 3686
    // We need enough messages to exceed that
    const messages = [
      msg("system", "sys"),
      ...Array.from({ length: 800 }, (_, i) => msg("user", `message ${i}`)),
    ];
    const result = truncateMessages(messages, 8192);

    expect(result.length).toBeLessThan(messages.length);
    // System message preserved
    expect(result[0]).toEqual(msg("system", "sys"));
    // Most recent messages preserved
    expect(result[result.length - 1]).toEqual(
      msg("user", `message ${messages.length - 2}`),
    );
  });

  it("never drops the system message", () => {
    const messages = [
      msg("system", "important system prompt"),
      ...Array.from({ length: 800 }, (_, i) => msg("user", `msg ${i}`)),
    ];
    const result = truncateMessages(messages, 8192);
    expect(result[0]).toEqual(msg("system", "important system prompt"));
  });

  it("always keeps at least one non-system message", () => {
    const messages = [
      msg("system", "sys"),
      ...Array.from({ length: 2000 }, (_, i) => msg("user", `msg ${i}`)),
    ];
    // Even with tiny context window, keep system + 1
    const result = truncateMessages(messages, 5000);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it("works without a system message", () => {
    const messages = Array.from({ length: 800 }, (_, i) =>
      msg("user", `message ${i}`),
    );
    const result = truncateMessages(messages, 8192);
    expect(result.length).toBeLessThan(messages.length);
    // Most recent preserved
    expect(result[result.length - 1]).toEqual(
      msg("user", `message ${messages.length - 1}`),
    );
  });

  it("returns messages unchanged when budget is zero or negative", () => {
    const messages = [msg("user", "hi")];
    // RESPONSE_RESERVE (4096) > contextWindow * 0.95
    expect(truncateMessages(messages, 100)).toEqual(messages);
  });
});
