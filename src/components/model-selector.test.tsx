import { render } from "ink-testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelSelector } from "./model-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const mockModelsResponse = (ids: string[]) =>
  new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }));

describe("ModelSelector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    const { lastFrame } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Fetching models...");
  });

  it("renders models after loading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const { lastFrame } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("qwen3:8b");
    expect(output).toContain("llama3:70b");
  });

  it("highlights the active model", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const { lastFrame } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    expect(lastFrame()).toContain("(active)");
  });

  it("calls onSelect with the chosen model on Enter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // Cursor starts on active model (qwen3:8b), move down to llama3:70b
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("llama3:70b");
  });

  it("calls onCancel on Escape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b"]),
    );
    const onCancel = vi.fn();
    const { stdin } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await flush();
    stdin.write("\x1B");
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows error when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const { lastFrame } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    expect(lastFrame()).toContain("Failed to fetch models");
  });

  it("shows empty state when no models available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockModelsResponse([]));
    const { lastFrame } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    expect(lastFrame()).toContain("No models available");
  });

  it("navigates with arrow keys", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["model-a", "model-b", "model-c"]),
    );
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="model-a"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // Cursor starts on model-a (active). Move down twice to model-c.
    stdin.write("\x1B[B");
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("model-c");
  });

  it("wraps cursor from bottom to top", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["model-a", "model-b"]),
    );
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        baseUrl="http://localhost:11434"
        activeModel="model-a"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // Cursor on model-a. Down to model-b, down again wraps to model-a.
    stdin.write("\x1B[B");
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("model-a");
  });
});
