import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCommand } from "./registry";
import "./models";

const mockCallbacks = () => ({
  onComplete: vi.fn(),
  onCancel: vi.fn(),
  clearMessages: vi.fn(),
  providerBaseUrl: "http://localhost:11434",
  activeModel: "qwen3:8b",
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

    const command = getCommand("models")!;
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

    const command = getCommand("models")!;
    const result = await command.execute("", mockCallbacks());

    expect(result).toHaveProperty("output");
    const output = (result as { output: string }).output;
    expect(output).toContain("No models available");
  });

  it("handles connection errors gracefully", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );

    const command = getCommand("models")!;
    const result = await command.execute("", mockCallbacks());

    expect(result).toHaveProperty("output");
    const output = (result as { output: string }).output;
    expect(output).toContain("Failed to fetch models");
  });
});
