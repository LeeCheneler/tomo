import { describe, it, expect, vi } from "vitest";
import type { Command } from "./types";
import { getCommand } from "./registry";
import "./use";

const mockCallbacks = () => ({
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  clearMessages: vi.fn(),
  setActiveModel: vi.fn(),
  providerBaseUrl: "http://localhost:11434",
  activeModel: "qwen3:8b",
});

describe("/use command", () => {
  it("is registered", () => {
    expect(getCommand("use")).toBeDefined();
  });

  it("switches model immediately when given an arg", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("llama3:70b", callbacks);

    expect(callbacks.setActiveModel).toHaveBeenCalledWith("llama3:70b");
    expect(result).toEqual({ output: "Switched to llama3:70b." });
  });

  it("returns interactive element when no arg given", () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = command.execute("", callbacks);

    expect(result).toHaveProperty("interactive");
  });
});
