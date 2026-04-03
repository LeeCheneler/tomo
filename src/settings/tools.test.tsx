import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import { mockConfig } from "../test-utils/mock-config";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { MockFsState } from "../test-utils/mock-fs";
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
  let fsState: MockFsState;

  afterEach(() => {
    fsState?.restore();
    setColumns(undefined);
  });

  /** Renders ToolsScreen with mocked config and fixed terminal width. */
  function renderTools(
    config: Parameters<typeof mockConfig>[0] = { global: {} },
  ) {
    setColumns(COLUMNS);
    fsState = mockConfig(config);
    const onBack = vi.fn();
    const result = renderInk(<ToolsScreen onBack={onBack} />);
    return { ...result, onBack };
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
      expect(frame).toContain("Run Command");
      expect(frame).toContain("Skill");
      expect(frame).toContain("Web Search");
      expect(frame).toContain("Write File");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderTools();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      expect(frame).toContain("toggle");
      expect(frame).toContain("back");
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
    it("toggles a tool on enter and persists to config", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      // Agent is first and enabled by default, toggle it off
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("[ ] Agent");
      const config = loadConfig();
      expect(config.tools.agent.enabled).toBe(false);
    });

    it("toggles a tool on space", async () => {
      const { stdin, lastFrame } = renderTools({ global: {} });
      await stdin.write(keys.enter);
      // Toggle it back on
      await stdin.write(" ");
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
            runCommand: { enabled: true },
            skill: { enabled: true },
            webSearch: { enabled: true, apiKey: "tvly-123" },
            writeFile: { enabled: true },
          },
        },
      });
      // Navigate to Web Search (9th item) and toggle
      for (let i = 0; i < 8; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.enter);
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

  describe("terminal width fallback", () => {
    it("uses 80 as default width when columns is undefined", () => {
      setColumns(undefined);
      fsState = mockConfig({ global: {} });
      const onBack = vi.fn();
      const { lastFrame } = renderInk(<ToolsScreen onBack={onBack} />);
      expect(lastFrame()).toContain("─".repeat(80));
    });
  });
});
