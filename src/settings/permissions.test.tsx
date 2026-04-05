import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import type { RenderInkConfig } from "../test-utils/ink";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { PermissionsScreen } from "./permissions";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("PermissionsScreen", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders PermissionsScreen with mocked config and fixed terminal width. */
  function renderPermissions(config: RenderInkConfig = {}) {
    setColumns(COLUMNS);
    const onBack = vi.fn();
    return {
      ...renderInk(<PermissionsScreen onBack={onBack} />, config),
      onBack,
    };
  }

  describe("rendering", () => {
    it("renders heading and borders", () => {
      const { lastFrame } = renderPermissions();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Permissions");
    });

    it("renders all permission labels", () => {
      const { lastFrame } = renderPermissions();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Read files (current directory)");
      expect(frame).toContain("Write files (current directory)");
      expect(frame).toContain("Read files (global)");
      expect(frame).toContain("Write files (global)");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderPermissions();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      expect(frame).toContain("toggle");
      expect(frame).toContain("back");
    });

    it("reflects config values in toggle state", () => {
      const { lastFrame } = renderPermissions({
        global: {
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: true,
            globalReadFile: false,
          },
        },
      });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[✓] Read files (current directory)");
      expect(frame).toContain("[✓] Write files (current directory)");
      expect(frame).toContain("[ ] Read files (global)");
      expect(frame).toContain("[ ] Write files (global)");
    });

    it("defaults optional permissions to off", () => {
      const { lastFrame } = renderPermissions({ global: {} });
      const frame = lastFrame() ?? "";
      // cwdReadFile defaults to true via schema
      expect(frame).toContain("[✓] Read files (current directory)");
      // Optional permissions default to off
      expect(frame).toContain("[ ] Write files (current directory)");
      expect(frame).toContain("[ ] Read files (global)");
      expect(frame).toContain("[ ] Write files (global)");
    });
  });

  describe("toggling", () => {
    it("toggles a permission on space and persists to config", async () => {
      const { stdin, lastFrame } = renderPermissions({ global: {} });
      // cwdReadFile starts as true, toggle it off
      await stdin.write(keys.space);
      expect(lastFrame()).toContain("[ ] Read files (current directory)");
      // Verify persisted
      const config = loadConfig();
      expect(config.permissions.cwdReadFile).toBe(false);
    });

    it("toggles a permission on space", async () => {
      const { stdin, lastFrame } = renderPermissions({ global: {} });
      await stdin.write(keys.down);
      await stdin.write(keys.space);
      expect(lastFrame()).toContain("[✓] Write files (current directory)");
    });

    it("persists toggled state to local config", async () => {
      const { stdin } = renderPermissions({ global: {} });
      // Navigate to cwdWriteFile and enable it
      await stdin.write(keys.down);
      await stdin.write(keys.space);
      const config = loadConfig();
      expect(config.permissions.cwdWriteFile).toBe(true);
    });
  });

  describe("navigation", () => {
    it("calls onBack on escape", async () => {
      const { stdin, onBack } = renderPermissions();
      await stdin.write(keys.escape);
      expect(onBack).toHaveBeenCalledOnce();
    });
  });

  describe("terminal width fallback", () => {
    it("uses 80 as default width when columns is undefined", () => {
      setColumns(undefined);
      const onBack = vi.fn();
      const { lastFrame } = renderInk(<PermissionsScreen onBack={onBack} />);
      expect(lastFrame()).toContain("─".repeat(80));
    });
  });
});
