import { describe, it, expect, vi } from "vitest";
import { getCommand } from "./registry";
import "./new";

describe("/new command", () => {
  it("is registered", () => {
    expect(getCommand("new")).toBeDefined();
  });

  it("calls clearMessages and returns confirmation", () => {
    const command = getCommand("new");
    const clearMessages = vi.fn();
    const callbacks = {
      onComplete: vi.fn(),
      onCancel: vi.fn(),
      clearMessages,
      providerBaseUrl: "http://localhost:11434",
      activeModel: "qwen3:8b",
    };

    const result = command!.execute("", callbacks);

    expect(clearMessages).toHaveBeenCalled();
    expect(result).toEqual({ output: "Conversation cleared." });
  });
});
