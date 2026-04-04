import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import { mockConfig } from "../test-utils/mock-config";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { MockFsState } from "../test-utils/mock-fs";
import { ProvidersScreen } from "./providers";

const COLUMNS = 80;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

/** Standard provider config for tests. */
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

describe("ProvidersScreen", () => {
  let fsState: MockFsState;

  afterEach(() => {
    fsState?.restore();
    setColumns(undefined);
  });

  /** Renders ProvidersScreen with mocked config and fixed terminal width. */
  function renderProviders(
    config: Parameters<typeof mockConfig>[0] = { global: {} },
  ) {
    setColumns(COLUMNS);
    fsState = mockConfig(config);
    const onBack = vi.fn();
    const result = renderInk(<ProvidersScreen onBack={onBack} />);
    return { ...result, onBack };
  }

  describe("rendering", () => {
    it("renders heading and borders", () => {
      const { lastFrame } = renderProviders();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Providers");
    });

    it("renders add row when no providers configured", () => {
      const { lastFrame } = renderProviders();
      expect(lastFrame()).toContain("Add provider...");
    });

    it("renders provider names", () => {
      const { lastFrame } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER, OPENROUTER_PROVIDER] },
      });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("my-ollama");
      expect(frame).toContain("my-openrouter");
    });

    it("shows options indicator on providers", () => {
      const { lastFrame } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      expect(lastFrame()).toContain("›");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderProviders();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      expect(frame).toContain("save/add/remove");
      expect(frame).toContain("options");
      expect(frame).toContain("back");
    });
  });

  describe("navigation", () => {
    it("calls onBack on escape", async () => {
      const { stdin, onBack } = renderProviders();
      await stdin.write(keys.escape);
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  describe("adding providers", () => {
    it("adds a provider with ollama defaults on enter", async () => {
      const { stdin, lastFrame } = renderProviders();
      await stdin.write("my-ollama");
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("my-ollama");
      const config = loadConfig();
      expect(config.providers).toHaveLength(1);
      expect(config.providers[0].name).toBe("my-ollama");
      expect(config.providers[0].type).toBe("ollama");
      expect(config.providers[0].baseUrl).toBe("http://localhost:11434");
    });

    it("does not add duplicate provider names", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write("my-ollama");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers).toHaveLength(1);
    });

    it("does not add empty names", async () => {
      const { stdin } = renderProviders();
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers).toHaveLength(0);
    });
  });

  describe("removing providers", () => {
    it("removes a provider when enter is pressed on empty draft", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      // Navigate to provider
      await stdin.write(keys.up);
      // Clear the name
      for (let i = 0; i < "my-ollama".length; i++) {
        await stdin.write(keys.delete);
      }
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers).toHaveLength(0);
    });
  });

  describe("renaming providers", () => {
    it("renames a provider on enter with changed draft", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write("-renamed");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].name).toBe("my-ollama-renamed");
    });

    it("preserves provider type and url when renaming", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OPENROUTER_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write("-v2");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].type).toBe("openrouter");
      expect(config.providers[0].baseUrl).toBe("https://openrouter.ai/api");
      expect(config.providers[0].apiKey).toBe("sk-test");
    });

    it("preserves other providers when renaming one", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER, OPENROUTER_PROVIDER] },
      });
      // Navigate to first provider (up twice from add row)
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      await stdin.write("-v2");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].name).toBe("my-ollama-v2");
      expect(config.providers[1].name).toBe("my-openrouter");
    });
  });

  describe("options form", () => {
    it("opens options form on tab", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("my-ollama Options");
      expect(frame).toContain("Type:");
      expect(frame).toContain("Name:");
      expect(frame).toContain("Base URL:");
      expect(frame).toContain("API Key:");
    });

    it("opens options form immediately after adding a provider", async () => {
      const { stdin, lastFrame } = renderProviders();
      await stdin.write("new-provider");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("new-provider Options");
      expect(frame).toContain("Type:");
    });

    it("shows form instructions", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("left/right");
      expect(frame).toContain("select");
      expect(frame).toContain("save");
      expect(frame).toContain("cancel");
    });

    it("shows api key env var hint for ollama", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      expect(lastFrame()).toContain("$OLLAMA_API_KEY");
    });

    it("shows api key env var hint for openrouter", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: { providers: [OPENROUTER_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      expect(lastFrame()).toContain("$OPENROUTER_API_KEY");
    });

    it("shows api key env var hint for opencode-zen", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: {
          providers: [
            {
              name: "my-zen",
              type: "opencode-zen",
              baseUrl: "https://opencode.ai/zen",
            },
          ],
        },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      expect(lastFrame()).toContain("$OPENCODE_API_KEY");
    });

    it("pre-fills form with current provider values", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: { providers: [OPENROUTER_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[✓] openrouter");
      expect(frame).toContain("my-openrouter");
      expect(frame).toContain("https://openrouter.ai/api");
      expect(frame).toContain("sk-test");
    });

    it("saves changes on enter", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      // Navigate to API Key field (4th) and type
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write("sk-saved");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].apiKey).toBe("sk-saved");
    });

    it("returns to list after saving", async () => {
      const { stdin, lastFrame } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Providers");
      expect(frame).toContain("Add provider...");
    });

    it("cancels on escape without saving", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      // Edit API Key
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write("sk-unsaved");
      await stdin.write(keys.escape);
      const config = loadConfig();
      expect(config.providers[0].apiKey).toBeUndefined();
    });

    it("updates type via select field", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      // Type is first field, change with right arrow
      await stdin.write(keys.right);
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].type).toBe("opencode-zen");
    });

    it("clears empty apiKey to undefined", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OPENROUTER_PROVIDER] },
      });
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      // Navigate to API Key and clear it
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      for (let i = 0; i < "sk-test".length; i++) {
        await stdin.write(keys.delete);
      }
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].apiKey).toBeUndefined();
    });

    it("preserves other providers when saving options", async () => {
      const { stdin } = renderProviders({
        global: { providers: [OLLAMA_PROVIDER, OPENROUTER_PROVIDER] },
      });
      // Navigate to first provider
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      // Change type
      await stdin.write(keys.right);
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.providers[0].type).toBe("opencode-zen");
      expect(config.providers[1].name).toBe("my-openrouter");
    });
  });
});
