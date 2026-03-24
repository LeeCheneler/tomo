import { render } from "ink-testing-library";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigureSelector } from "./configure-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const mockModelsResponse = (ids: string[]) =>
  new Response(JSON.stringify({ data: ids.map((id) => ({ id })) }));

const defaultProviders = [
  { name: "ollama", baseUrl: "http://localhost:11434", type: "ollama" },
];

const multiProviders = [
  { name: "ollama", baseUrl: "http://localhost:11434", type: "ollama" },
  { name: "openai", baseUrl: "https://api.openai.com", type: "openai" },
];

describe("ConfigureSelector", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders menu with add and remove options", () => {
    const { lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Add provider");
    expect(output).toContain("Remove provider");
  });

  it("calls onCancel on Escape at menu", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={onCancel}
      />,
    );
    stdin.write("\x1B");
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it("navigates to select type step on add provider", async () => {
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Enter on "Add provider"
    stdin.write("\r");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("Select provider type");
    expect(output).toContain("ollama");
    expect(output).toContain("openai");
  });

  it("shows remove provider list", async () => {
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={multiProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // Move down to "Remove provider", enter
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("Select provider to remove");
    expect(output).toContain("openai");
    // Active provider should be shown but marked as active (not selectable)
    expect(output).toContain("ollama (active)");
    // Cursor should not be on the active provider
    expect(output).not.toContain("❯ ollama");
  });

  it("calls onRemoveProvider when selecting a provider to remove", async () => {
    const onRemoveProvider = vi.fn();
    const { stdin } = render(
      <ConfigureSelector
        providers={multiProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={onRemoveProvider}
        onCancel={vi.fn()}
      />,
    );
    // Navigate to remove, select openai
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onRemoveProvider).toHaveBeenCalledWith("openai");
  });

  it("disables remove option when no removable providers", () => {
    const { lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(lastFrame()).toContain("no removable providers");
  });

  it("completes full add provider flow for ollama", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["llama3:8b", "qwen3:8b"]),
    );
    const onAddProvider = vi.fn();
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={onAddProvider}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Menu: select "Add provider"
    stdin.write("\r");
    await flush();

    // Select type: ollama (first option)
    stdin.write("\r");
    await flush();

    // Enter URL: default should be pre-filled, just press enter
    expect(lastFrame()).toContain("http://localhost:11434");
    stdin.write("\r");
    await flush();

    // Should skip API key for ollama and go straight to fetching models
    await flush();

    // Select model: pick second model
    expect(lastFrame()).toContain("llama3:8b");
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    // Enter name: default is "ollama", change to "my-ollama"
    // Clear default text and type new name
    for (let i = 0; i < 6; i++) {
      stdin.write("\x7F"); // backspace
    }
    await flush();
    stdin.write("my-ollama");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onAddProvider).toHaveBeenCalledWith(
      {
        name: "my-ollama",
        type: "ollama",
        baseUrl: "http://localhost:11434",
        apiKey: undefined,
      },
      "qwen3:8b",
    );
  });

  it("completes full add provider flow for openai with api key", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["gpt-4o", "gpt-4o-mini"]),
    );
    const onAddProvider = vi.fn();
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={onAddProvider}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Menu: select "Add provider"
    stdin.write("\r");
    await flush();

    // Select type: openai (second option)
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    // Enter URL: accept default
    expect(lastFrame()).toContain("https://api.openai.com");
    stdin.write("\r");
    await flush();

    // Enter API key
    expect(lastFrame()).toContain("Enter API key");
    stdin.write("sk-test-123");
    await flush();
    stdin.write("\r");
    await flush();

    // Fetching models...
    await flush();

    // Select model: first one
    expect(lastFrame()).toContain("gpt-4o");
    stdin.write("\r");
    await flush();

    // Enter name: accept default "openai"
    stdin.write("\r");
    await flush();

    expect(onAddProvider).toHaveBeenCalledWith(
      {
        name: "openai",
        type: "openai",
        baseUrl: "https://api.openai.com",
        apiKey: "sk-test-123",
      },
      "gpt-4o",
    );
  });

  it("shows error when model fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("fetch failed"),
    );
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Add provider -> ollama -> enter URL
    stdin.write("\r");
    await flush();
    stdin.write("\r");
    await flush();
    stdin.write("\r");
    await flush();
    await flush();

    expect(lastFrame()).toContain("Failed to fetch models");
  });

  it("prevents duplicate provider names", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockModelsResponse(["llama3:8b"]),
    );
    const onAddProvider = vi.fn();
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={onAddProvider}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Add provider -> ollama -> enter URL -> select model
    stdin.write("\r");
    await flush();
    stdin.write("\r");
    await flush();
    stdin.write("\r");
    await flush();
    await flush();
    stdin.write("\r");
    await flush();

    // Enter name "ollama" (which already exists)
    stdin.write("\r");
    await flush();

    expect(lastFrame()).toContain("already exists");
    expect(onAddProvider).not.toHaveBeenCalled();
  });

  it("goes back to menu on Escape from any step", async () => {
    const { stdin, lastFrame } = render(
      <ConfigureSelector
        providers={defaultProviders}
        activeProvider="ollama"
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Go to selectType
    stdin.write("\r");
    await flush();
    expect(lastFrame()).toContain("Select provider type");

    // Escape back to menu
    stdin.write("\x1B");
    await flush();
    expect(lastFrame()).toContain("Add provider");
  });
});
