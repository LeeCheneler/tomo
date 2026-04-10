import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import type { RenderInkConfig } from "../test-utils/ink";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { ToolsScreen } from "./tools";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("ToolsScreen", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders ToolsScreen with mocked config and fixed terminal width. */
  function renderTools(config: RenderInkConfig = {}) {
    setColumns(COLUMNS);
    const onBack = vi.fn();
    return { ...renderInk(<ToolsScreen onBack={onBack} />, config), onBack };
  }

  describe("rendering", () => {
    it("renders heading and borders", () => {
      const { lastFrame } = renderTools();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Tools");
    });

    it("renders all tool labels", () => {
      const { lastFrame } = renderTools();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Agent");
      expect(frame).toContain("Ask");
      expect(frame).toContain("Edit File");
      expect(frame).toContain("Glob");
      expect(frame).toContain("Grep");
      expect(frame).toContain("Read File");
      expect(frame).toContain("Remove File");
      expect(frame).toContain("Run Command");
      expect(frame).toContain("Skill");
      expect(frame).toContain("Web Search");
      expect(frame).toContain("Write File");
    });

    it("shows key instructions including options", () => {
      const { lastFrame } = renderTools();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("toggle");
      expect(frame).toContain("options");
      expect(frame).toContain("back");
    });

    it("shows options indicator on web search", () => {
      const { lastFrame } = renderTools();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Web Search ›");
      expect(frame).not.toContain("Agent ›");
    });

    it("reflects config values in toggle state", () => {
      const { lastFrame } = renderTools({ global: {} });
      const frame = lastFrame() ?? "";
      // Default: webSearch is disabled, others are enabled
      expect(frame).toContain("[✓] Agent");
      expect(frame).toContain("[✓] Read File");
      expect(frame).toContain("[ ] Web Search");
    });
  });

  describe("toggling", () => {
    it("toggles a tool on space and persists to config", async () => {
      const { stdin, lastFrame, getConfig } = renderTools({ global: {} });
      // Agent is first and enabled by default, toggle it off
      await stdin.write(keys.space);
      expect(lastFrame()).toContain("[ ] Agent");
      const config = loadConfig();
      expect(config.tools.agent.enabled).toBe(false);
      // Verify config context was reloaded
      expect(getConfig().tools.agent.enabled).toBe(false);
    });

    it("toggles back on second space", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await stdin.write(keys.space);
      await stdin.write(keys.space);
      expect(lastFrame()).toContain("[✓] Agent");
    });

    it("preserves other tool fields when toggling", async () => {
      const { stdin } = renderTools({
        global: {
          tools: {
            agent: { enabled: true },
            ask: { enabled: true },
            editFile: { enabled: true },
            glob: { enabled: true },
            grep: { enabled: true },
            readFile: { enabled: true },
            removeFile: { enabled: true },
            runCommand: { enabled: true },
            skill: { enabled: true },
            webSearch: { enabled: true, apiKey: "tvly-123" },
            writeFile: { enabled: true },
          },
        },
      });
      // Navigate to Web Search (10th item) and toggle
      for (let i = 0; i < 9; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.space);
      const config = loadConfig();
      expect(config.tools.webSearch.enabled).toBe(false);
      expect(config.tools.webSearch.apiKey).toBe("tvly-123");
    });
  });

  describe("navigation", () => {
    it("calls onBack on escape", async () => {
      const { stdin, onBack } = renderTools();
      await stdin.write(keys.escape);
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  describe("options form", () => {
    /** Navigates to Web Search and opens the options form. */
    async function openWebSearchOptions(stdin: {
      write: (s: string) => Promise<void>;
    }) {
      for (let i = 0; i < 9; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.tab);
    }

    it("opens options form on tab for web search", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Web Search Options");
      expect(frame).toContain("Enabled");
      expect(frame).toContain("API Key:");
    });

    it("shows form instructions", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("save");
      expect(frame).toContain("cancel");
    });

    it("cancels and returns to tools list on escape", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Tools");
      expect(frame).toContain("Agent");
    });

    it("does not save on escape", async () => {
      const { stdin } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      // Navigate to API Key field and type
      await stdin.write(keys.down);
      await stdin.write("tvly-unsaved");
      await stdin.write(keys.escape);
      const config = loadConfig();
      expect(config.tools.webSearch.apiKey).toBeUndefined();
    });

    it("does not open options for tools without hasOptions", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Tools");
      expect(frame).not.toContain("Options");
    });

    it("saves api key on enter", async () => {
      const { stdin, getConfig } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      await stdin.write(keys.down);
      await stdin.write("tvly-saved");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.tools.webSearch.apiKey).toBe("tvly-saved");
      // Verify config context was reloaded
      expect(getConfig().tools.webSearch.apiKey).toBe("tvly-saved");
    });

    it("saves enabled toggle from form", async () => {
      const { stdin } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      // Enabled is first field, toggle it with space
      await stdin.write(keys.space);
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.tools.webSearch.enabled).toBe(true);
    });

    it("returns to tools list after saving", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await openWebSearchOptions(stdin);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Tools");
      expect(frame).toContain("Agent");
    });
  });

  describe("terminal width fallback", () => {
    it("uses 80 as default width when columns is undefined", () => {
      setColumns(undefined);
      const onBack = vi.fn();
      const { lastFrame } = renderInk(<ToolsScreen onBack={onBack} />);
      expect(lastFrame()).toContain("─".repeat(80));
    });
  });
});
