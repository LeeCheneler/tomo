import { describe, expect, it } from "vitest";
import type { ChatMessage } from "../provider/client";
import { truncateMessages } from "./truncate";

function msg(role: ChatMessage["role"], content: string): ChatMessage {
  return { role, content };
}

describe("truncateMessages", () => {
  it("returns messages unchanged when no usage data is available", () => {
    const messages = [msg("user", "hi"), msg("assistant", "hello")];
    expect(truncateMessages(messages, 8192, 4096, null)).toEqual(messages);
  });

  it("returns messages unchanged when under budget", () => {
    const messages = [
      msg("system", "you are helpful"),
      msg("user", "hi"),
      msg("assistant", "hello"),
    ];
    // 100 prompt tokens, budget = 8192 - 4096 = 4096, well under
    expect(truncateMessages(messages, 8192, 4096, 100)).toEqual(messages);
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
    // 5 non-system messages, 10000 prompt tokens
    // budget = 8192 - 4096 = 4096, estimated ~10000, over budget
    const result = truncateMessages(messages, 8192, 4096, 10000);

    expect(result[0]).toEqual(msg("system", "sys"));
    expect(result.length).toBeLessThan(messages.length);
    expect(result[result.length - 1]).toEqual(msg("user", "msg3"));
  });

  it("never drops the system message", () => {
    const messages = [
      msg("system", "important system prompt"),
      msg("user", "hi"),
    ];
    const result = truncateMessages(messages, 8192, 4096, 50000);
    expect(result[0]).toEqual(msg("system", "important system prompt"));
  });

  it("always keeps at least one non-system message", () => {
    const messages = [
      msg("system", "sys"),
      msg("user", "msg1"),
      msg("assistant", "resp1"),
      msg("user", "latest"),
    ];
    const result = truncateMessages(messages, 8192, 4096, 50000);
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[result.length - 1]).toEqual(msg("user", "latest"));
  });

  it("returns empty array unchanged", () => {
    expect(truncateMessages([], 8192, 4096, 100)).toEqual([]);
  });

  it("works without a system message", () => {
    const messages = [
      msg("user", "msg1"),
      msg("assistant", "resp1"),
      msg("user", "msg2"),
      msg("assistant", "resp2"),
      msg("user", "msg3"),
    ];
    // 5 messages, 10000 tokens, budget = 8192 - 4096 = 4096
    const result = truncateMessages(messages, 8192, 4096, 10000);
    expect(result.length).toBeLessThan(messages.length);
    expect(result[result.length - 1]).toEqual(msg("user", "msg3"));
  });

  it("respects different maxTokens values", () => {
    const messages = [
      msg("system", "sys"),
      msg("user", "msg1"),
      msg("assistant", "resp1"),
      msg("user", "msg2"),
    ];
    // With large maxTokens (small budget), should truncate
    const small = truncateMessages(messages, 8192, 7000, 5000);
    // With small maxTokens (large budget), should keep all
    const large = truncateMessages(messages, 8192, 1000, 5000);

    expect(small.length).toBeLessThan(messages.length);
    expect(large).toEqual(messages);
  });
});
