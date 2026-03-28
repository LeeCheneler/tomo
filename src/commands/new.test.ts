import { describe, expect, it, vi } from "vitest";
import { getCommand } from "./registry";
import type { Command } from "./types";
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
      reloadProviders: vi.fn(),
      providerBaseUrl: "http://localhost:11434",
      activeModel: "qwen3:8b",
      activeProvider: "ollama",
      providers: [
        { name: "ollama", baseUrl: "http://localhost:11434", type: "ollama" },
      ],
      contextWindow: 8192,
      maxTokens: 8192,
      tokenUsage: null,
      messageCount: 0,
      mcpFailedServers: [],
    };

    const result = command.execute("", callbacks);

    expect(clearMessages).toHaveBeenCalled();
    expect(result).toEqual({ output: "Conversation cleared." });
  });
});
