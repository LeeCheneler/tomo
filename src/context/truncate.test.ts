import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../provider/client";
import { truncateMessages } from "./truncate";

function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

describe("truncateMessages", () => {
  it("returns messages unchanged when no usage data is available", () => {
    const messages = [msg("user", "hi"), msg("assistant", "hello")];
    expect(truncateMessages(messages, 4096, null)).toEqual(messages);
  });

  it("returns messages unchanged when under budget", () => {
    const messages = [
      msg("system", "you are helpful"),
      msg("user", "hi"),
      msg("assistant", "hello"),
    ];
    // 100 prompt tokens for 2 non-system messages, context window 4096
    // budget = 3072, estimated ~100, well under
    expect(truncateMessages(messages, 4096, 100)).toEqual(messages);
  });

  it("drops oldest non-system messages when over budget", () => {
    const messages = [
      msg("system", "sys"),
      msg("user", "msg1"),
      msg("assistant", "resp1"),
      msg("user", "msg2"),
      msg("assistant", "resp2"),
      msg("user", "msg3"),
    ];
    // 5 non-system messages, 2500 prompt tokens => 500 tokens/msg avg
    // system overhead ~250, total estimate ~2750
    // budget for contextWindow=1000 => 750
    // Need to drop messages until under 750
    const result = truncateMessages(messages, 1000, 2500);

    // System message preserved
    expect(result[0]).toEqual(msg("system", "sys"));
    // Oldest messages dropped
    expect(result.length).toBeLessThan(messages.length);
    // Last message (most recent) preserved
    expect(result[result.length - 1]).toEqual(msg("user", "msg3"));
  });

  it("never drops the system message", () => {
    const messages = [
      msg("system", "important system prompt"),
      msg("user", "hi"),
    ];
    // Even with tiny context window, system message stays
    const result = truncateMessages(messages, 100, 5000);
    expect(result[0]).toEqual(msg("system", "important system prompt"));
  });

  it("always keeps at least one non-system message", () => {
    const messages = [
      msg("system", "sys"),
      msg("user", "msg1"),
      msg("assistant", "resp1"),
      msg("user", "latest"),
    ];
    const result = truncateMessages(messages, 10, 50000);
    // System + at least the latest message
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[result.length - 1]).toEqual(msg("user", "latest"));
  });

  it("returns empty array unchanged", () => {
    expect(truncateMessages([], 4096, 100)).toEqual([]);
  });

  it("works without a system message", () => {
    const messages = [
      msg("user", "msg1"),
      msg("assistant", "resp1"),
      msg("user", "msg2"),
      msg("assistant", "resp2"),
      msg("user", "msg3"),
    ];
    // 5 messages, 2500 tokens => 500/msg, budget for 1000 = 750
    const result = truncateMessages(messages, 1000, 2500);
    expect(result.length).toBeLessThan(messages.length);
    expect(result[result.length - 1]).toEqual(msg("user", "msg3"));
  });
});
