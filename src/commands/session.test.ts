import { describe, it, expect, vi } from "vitest";
import type { Command } from "./types";
import { getCommand } from "./registry";
import "./session";

const mockCallbacks = () => ({
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  clearMessages: vi.fn(),
  switchSession: vi.fn((_id: string): string | null => null),
  setActiveModel: vi.fn(),
  setActiveProvider: vi.fn((_name: string): string | null => null),
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
});

describe("/session command", () => {
  it("is registered", () => {
    expect(getCommand("session")).toBeDefined();
  });

  it("loads session by ID when arg is provided", () => {
    const command = getCommand("session") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("abc-123", callbacks);

    expect(callbacks.switchSession).toHaveBeenCalledWith("abc-123");
    expect(result).toEqual({ output: "Session loaded." });
  });

  it("returns error when session not found", () => {
    const command = getCommand("session") as Command;
    const callbacks = mockCallbacks();
    callbacks.switchSession.mockReturnValue("Session not found: bad-id");
    const result = command.execute("bad-id", callbacks);

    expect(result).toEqual({ output: "Session not found: bad-id" });
  });

  it("returns interactive element when no arg given", () => {
    const command = getCommand("session") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("", callbacks);

    expect(result).toHaveProperty("interactive");
  });
});
