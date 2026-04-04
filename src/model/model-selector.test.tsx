import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { MockFsState } from "../test-utils/mock-fs";
import { ModelSelector } from "./model-selector";

const COLUMNS = 80;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

/** Standard provider configs for tests. */
const OLLAMA_PROVIDER = {
  name: "my-ollama",
  type: "ollama" as const,
  baseUrl: "http://localhost:11434",
};

const OPENROUTER_PROVIDER = {
  name: "my-openrouter",
  type: "openrouter" as const,
  baseUrl: "https://openrouter.ai/api",
  apiKey: "sk-test",
};

describe("ModelSelector", () => {
  let fsState: MockFsState;

  afterEach(() => {
    fsState?.restore();
    setColumns(undefined);
  });

  /** Renders ModelSelector with mocked config. */
  function renderModelSelector(
    config: Parameters<typeof mockConfig>[0] = { global: {} },
  ) {
    setColumns(COLUMNS);
    fsState = mockConfig(config);
    const onDone = vi.fn();
    const result = renderInk(<ModelSelector onDone={onDone} />);
    return { ...result, onDone };
  }

  describe("provider list", () => {
    it("renders heading and borders", () => {
      const { lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Select Model");
    });

    it("renders configured providers", () => {
      const { lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER, OPENROUTER_PROVIDER] },
      });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("my-ollama");
      expect(frame).toContain("my-openrouter");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      expect(frame).toContain("select");
      expect(frame).toContain("back");
    });

    it("closes on escape", async () => {
      const { stdin, onDone } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.escape);
      expect(onDone).toHaveBeenCalledOnce();
    });

    it("enters model list on enter", async () => {
      const { stdin, lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("Select Model — my-ollama");
    });
  });

  describe("no providers", () => {
    it("shows message when no providers configured", () => {
      const { lastFrame } = renderModelSelector();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("No providers configured");
      expect(frame).toContain("/settings");
    });

    it("does not render a navigation menu", () => {
      const { lastFrame } = renderModelSelector();
      expect(lastFrame()).not.toContain("❯");
    });

    it("closes on escape", async () => {
      const { stdin, onDone } = renderModelSelector();
      await stdin.write(keys.escape);
      expect(onDone).toHaveBeenCalledOnce();
    });

    it("ignores other keys", async () => {
      const { stdin, onDone } = renderModelSelector();
      await stdin.write("x");
      expect(onDone).not.toHaveBeenCalled();
    });
  });

  describe("model list placeholder", () => {
    it("shows provider name in heading", async () => {
      const { stdin, lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("Select Model — my-ollama");
    });

    it("returns to provider list on escape", async () => {
      const { stdin, lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Select Model");
      expect(frame).toContain("my-ollama");
      expect(frame).not.toContain("Coming soon");
    });

    it("ignores other keys", async () => {
      const { stdin, lastFrame } = renderModelSelector({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.enter);
      await stdin.write("x");
      expect(lastFrame()).toContain("Coming soon");
    });
  });
});
