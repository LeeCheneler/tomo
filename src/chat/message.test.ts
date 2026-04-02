import { describe, expect, it } from "vitest";
import type { ChatMessage, UserMessage } from "./message";

describe("ChatMessage", () => {
  it("accepts a user message", () => {
    const message: ChatMessage = {
      id: "1",
      role: "user",
      content: "hello",
    };
    expect(message.role).toBe("user");
    expect(message.content).toBe("hello");
  });

  it("narrows to UserMessage via role discriminant", () => {
    const message: ChatMessage = {
      id: "1",
      role: "user",
      content: "hello",
    };
    if (message.role === "user") {
      const user: UserMessage = message;
      expect(user.content).toBe("hello");
    }
  });
});
