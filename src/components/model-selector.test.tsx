import { render } from "ink-testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelSelector } from "./model-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const mockModelsResponse = (ids: string[]) =>
  new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }));

const singleProvider = [
  { name: "ollama", baseUrl: "http://localhost:11434", type: "ollama" },
];

const multiProvider = [
  { name: "ollama", baseUrl: "http://localhost:11434", type: "ollama" },
  { name: "openrouter", baseUrl: "http://localhost:4000", type: "openrouter" },
];

describe("ModelSelector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading state initially", () => {
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise(() => {}));
    const { lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("Fetching models...");
  });

  it("renders models grouped by provider", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const { lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("ollama");
    expect(output).toContain("qwen3:8b");
    expect(output).toContain("llama3:70b");
  });

  it("highlights the active model", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const { lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    expect(lastFrame()).toContain("(active)");
  });

  it("calls onSelect with provider and model on Enter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
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
    expect(onSelect).toHaveBeenCalledWith("ollama", "llama3:70b");
  });

  it("calls onCancel on Escape", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b"]),
    );
    const onCancel = vi.fn();
    const { stdin } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
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
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // With no selectable models and all providers erroring, shows no models message
    expect(lastFrame()).toContain("No models available");
  });

  it("shows empty state when no models available", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockModelsResponse([]));
    const { lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
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
        providers={singleProvider}
        activeProvider="ollama"
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
    expect(onSelect).toHaveBeenCalledWith("ollama", "model-c");
  });

  it("wraps cursor from bottom to top", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["model-a", "model-b"]),
    );
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
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
    expect(onSelect).toHaveBeenCalledWith("ollama", "model-a");
  });

  it("renders models from multiple providers", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(mockModelsResponse(["qwen3:8b"]));
      }
      return Promise.resolve(mockModelsResponse(["gpt-4o"]));
    });
    const { lastFrame } = render(
      <ModelSelector
        providers={multiProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("ollama");
    expect(output).toContain("qwen3:8b");
    expect(output).toContain("openrouter");
    expect(output).toContain("gpt-4o");
  });

  it("filters models by typing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b", "llama3:8b"]),
    );
    const { stdin, lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // Type "llama" to filter
    stdin.write("llama");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("llama3:70b");
    expect(output).toContain("llama3:8b");
    expect(output).not.toContain("qwen3:8b");
    expect(output).toContain("2 of 3");
  });

  it("selects filtered model on Enter", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b", "llama3:8b"]),
    );
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // Type "llama" to filter, cursor should be on first match (llama3:70b)
    stdin.write("llama");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("ollama", "llama3:70b");
  });

  it("clears filter on Escape without cancelling", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );
    await flush();
    // Type to filter
    stdin.write("llama");
    await flush();
    expect(lastFrame()).not.toContain("qwen3:8b");
    // Escape clears filter
    stdin.write("\x1B");
    await flush();
    expect(lastFrame()).toContain("qwen3:8b");
    expect(onCancel).not.toHaveBeenCalled();
    // Second Escape cancels
    stdin.write("\x1B");
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows no match message when filter has no results", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["qwen3:8b", "llama3:70b"]),
    );
    const { stdin, lastFrame } = render(
      <ModelSelector
        providers={singleProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    stdin.write("zzzzz");
    await flush();
    expect(lastFrame()).toContain("No models match");
  });

  it("selects model from second provider", async () => {
    let callCount = 0;
    vi.spyOn(globalThis, "fetch").mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve(mockModelsResponse(["qwen3:8b"]));
      }
      return Promise.resolve(mockModelsResponse(["gpt-4o"]));
    });
    const onSelect = vi.fn();
    const { stdin } = render(
      <ModelSelector
        providers={multiProvider}
        activeProvider="ollama"
        activeModel="qwen3:8b"
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );
    await flush();
    // Cursor on qwen3:8b (active). Down once to gpt-4o (skips header).
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("openrouter", "gpt-4o");
  });
});
