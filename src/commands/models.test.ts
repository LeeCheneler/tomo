import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Command } from "./types";
import { getCommand } from "./registry";
import "./models";

const mockCallbacks = () => ({
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  clearMessages: vi.fn(),
  switchSession: vi.fn((_id: string): string | null => null),
  setActiveModel: vi.fn(),
  setActiveProvider: vi.fn(() => null),
  providerBaseUrl: "http://localhost:11434",
  activeModel: "qwen3:8b",
  activeProvider: "ollama",
  providerNames: ["ollama"],
});

describe("/models command", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("is registered", () => {
    expect(getCommand("models")).toBeDefined();
  });

  it("lists available models and highlights the active one", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "qwen3:8b" }, { id: "llama3:70b" }],
        }),
      ),
    );

    const command = getCommand("models") as Command;
    const result = await command.execute("", mockCallbacks());

    expect(result).toHaveProperty("output");
    const output = (result as { output: string }).output;
    expect(output).toContain("* qwen3:8b (active)");
    expect(output).toContain("llama3:70b");
  });

  it("handles empty model list", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] })),
    );

    const command = getCommand("models") as Command;
    const result = await command.execute("", mockCallbacks());

    expect(result).toHaveProperty("output");
    const output = (result as { output: string }).output;
    expect(output).toContain("No models available");
  });

  it("handles connection errors gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );

    const command = getCommand("models") as Command;
    const result = await command.execute("", mockCallbacks());

    expect(result).toHaveProperty("output");
    const output = (result as { output: string }).output;
    expect(output).toContain("Failed to fetch models");
  });
});
