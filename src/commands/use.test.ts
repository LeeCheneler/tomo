import { describe, it, expect, vi } from "vitest";
import type { Command } from "./types";
import { getCommand } from "./registry";
import "./use";

const mockCallbacks = () => ({
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  clearMessages: vi.fn(),
  setActiveModel: vi.fn(),
  setActiveProvider: vi.fn((_name: string): string | null => null),
  providerBaseUrl: "http://localhost:11434",
  activeModel: "qwen3:8b",
  activeProvider: "ollama",
  providerNames: ["ollama"],
});

describe("/use command", () => {
  it("is registered", () => {
    expect(getCommand("use")).toBeDefined();
  });

  it("switches model immediately when given a model arg", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("llama3:70b", callbacks);

    expect(callbacks.setActiveModel).toHaveBeenCalledWith("llama3:70b");
    expect(result).toEqual({ output: "Switched to llama3:70b." });
  });

  it("switches provider and model with provider/model syntax", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("ollama/llama3:70b", callbacks);

    expect(callbacks.setActiveProvider).toHaveBeenCalledWith("ollama");
    expect(callbacks.setActiveModel).toHaveBeenCalledWith("llama3:70b");
    expect(result).toEqual({ output: "Switched to ollama/llama3:70b." });
  });

  it("returns error for unknown provider", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    callbacks.setActiveProvider.mockReturnValue("Unknown provider: bad");
    const result = command.execute("bad/model", callbacks);

    expect(result).toHaveProperty("output");
    expect((result as { output: string }).output).toContain("Unknown provider");
  });

  it("returns error for invalid provider/model syntax", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("/model", callbacks);

    expect(result).toHaveProperty("output");
    expect((result as { output: string }).output).toContain("Usage");
  });

  it("returns interactive element when no arg given", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("", callbacks);

    expect(result).toHaveProperty("interactive");
  });
});
