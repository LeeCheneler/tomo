import { describe, expect, it } from "vitest";
import type { ChatMessage, CommandMessage, UserMessage } from "./message";

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

  it("accepts a command message", () => {
    const message: ChatMessage = {
      id: "2",
      role: "command",
      command: "settings",
      result: "Settings saved successfully",
    };
    expect(message.role).toBe("command");
    expect(message.command).toBe("settings");
    expect(message.result).toBe("Settings saved successfully");
  });

  it("narrows to CommandMessage via role discriminant", () => {
    const message: ChatMessage = {
      id: "2",
      role: "command",
      command: "ping",
      result: "pong",
    };
    if (message.role === "command") {
      const cmd: CommandMessage = message;
      expect(cmd.command).toBe("ping");
      expect(cmd.result).toBe("pong");
    }
  });
});
