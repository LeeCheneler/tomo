import { describe, it, expect, vi } from "vitest";
import { getCommand } from "./registry";
import "./model";

const mockCallbacks = () => ({
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  clearMessages: vi.fn(),
  switchSession: vi.fn((_id: string): string | null => null),
  setActiveModel: vi.fn(),
  setActiveProvider: vi.fn((_name: string): string | null => null),
  providerBaseUrl: "http://localhost:11434",
  activeModel: "qwen3:8b",
  activeProvider: "ollama",
  providers: [{ name: "ollama", baseUrl: "http://localhost:11434" }],
  contextWindow: 8192,
  maxTokens: 8192,
  tokenUsage: null,
  messageCount: 0,
});

describe("/model command", () => {
  it("is registered", () => {
    expect(getCommand("model")).toBeDefined();
  });

  it("returns interactive element", () => {
    const command = getCommand("model");
    if (!command) throw new Error("model command not registered");
    const result = command.execute("", mockCallbacks());
    expect(result).toHaveProperty("interactive");
  });
});
