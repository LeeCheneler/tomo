import { describe, it, expect, vi, beforeEach } from "vitest";
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

const mockModelsResponse = (ids: string[]) =>
  new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }));

describe("/use command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is registered", () => {
    expect(getCommand("use")).toBeDefined();
  });

  it("switches model immediately when given a valid model arg", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = await command.execute("llama3:70b", callbacks);

    expect(callbacks.setActiveModel).toHaveBeenCalledWith("llama3:70b");
    expect(result).toEqual({ output: "Switched to llama3:70b." });
  });

  it("returns error for unknown model", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = await command.execute("nonexistent", callbacks);

    expect(callbacks.setActiveModel).not.toHaveBeenCalled();
    const output = (result as { output: string }).output;
    expect(output).toContain("Unknown model: nonexistent");
    expect(output).toContain("Available:");
  });

  it("switches provider and model with provider/model syntax", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["llama3:70b"]),
    );
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = await command.execute("ollama/llama3:70b", callbacks);

    expect(callbacks.setActiveProvider).toHaveBeenCalledWith("ollama");
    expect(callbacks.setActiveModel).toHaveBeenCalledWith("llama3:70b");
    expect(result).toEqual({ output: "Switched to ollama/llama3:70b." });
  });

  it("returns error for unknown provider", async () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    callbacks.setActiveProvider.mockReturnValue("Unknown provider: bad");
    const result = await command.execute("bad/model", callbacks);

    const output = (result as { output: string }).output;
    expect(output).toContain("Unknown provider");
  });

  it("returns error for invalid provider/model syntax", async () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = await command.execute("/model", callbacks);

    const output = (result as { output: string }).output;
    expect(output).toContain("Usage");
  });

  it("returns interactive element when no arg given", async () => {
    const command = getCommand("use") as Command;
    const callbacks = mockCallbacks();
    const result = await command.execute("", callbacks);

    expect(result).toHaveProperty("interactive");
  });
});
