import { describe, it, expect, vi } from "vitest";
import type { Command } from "./types";
import { getCommand } from "./registry";
import "./new";

describe("/new command", () => {
  it("is registered", () => {
    expect(getCommand("new")).toBeDefined();
  });

  it("calls clearMessages and returns confirmation", () => {
    const command = getCommand("new") as Command;
    const clearMessages = vi.fn();
    const callbacks = {
      onComplete: vi.fn(),
      onCancel: vi.fn(),
      clearMessages,
      switchSession: vi.fn((_id: string): string | null => null),
      setActiveModel: vi.fn(),
      setActiveProvider: vi.fn(() => null),
      providerBaseUrl: "http://localhost:11434",
      activeModel: "qwen3:8b",
      activeProvider: "ollama",
      providerNames: ["ollama"],
    };

    const result = command.execute("", callbacks);

    expect(clearMessages).toHaveBeenCalled();
    expect(result).toEqual({ output: "Conversation cleared." });
  });
});
