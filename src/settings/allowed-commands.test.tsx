import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { AllowedCommandsScreen } from "./allowed-commands";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("AllowedCommandsScreen", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders AllowedCommandsScreen with mocked config and fixed terminal width. */
  function renderAllowedCommands(localOverrides: Record<string, unknown> = {}) {
    setColumns(COLUMNS);
    const onBack = vi.fn();
    return {
      ...renderInk(<AllowedCommandsScreen onBack={onBack} />, {
        local: {
          allowedCommands: ["npm test", "npm run build"],
          ...localOverrides,
        },
      }),
      onBack,
    };
  }

  describe("rendering", () => {
    it("renders heading, borders, and existing commands", () => {
      const { lastFrame } = renderAllowedCommands();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Allowed Commands");
      expect(frame).toContain("npm test");
      expect(frame).toContain("npm run build");
      expect(frame).toContain("Exact match");
      expect(frame).toContain("git:*");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderAllowedCommands();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      expect(frame).toContain("save/add/remove");
      expect(frame).toContain("back");
    });

    it("shows add row with placeholder", () => {
      const { lastFrame } = renderAllowedCommands();
      expect(lastFrame()).toContain("Add command...");
    });

    it("falls back to 80 columns when undefined", () => {
      setColumns(undefined);
      const { lastFrame } = renderInk(
        <AllowedCommandsScreen onBack={() => {}} />,
      );
      expect(lastFrame()).toContain("─".repeat(80));
    });
  });

  describe("adding a command", () => {
    it("persists a new command to config", async () => {
      const { stdin } = renderAllowedCommands();
      // Cursor starts on add row
      await stdin.write("npm lint");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.allowedCommands).toEqual([
        "npm test",
        "npm run build",
        "npm lint",
      ]);
    });

    it("rejects duplicate commands", async () => {
      const { stdin } = renderAllowedCommands();
      await stdin.write("npm test");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.allowedCommands).toEqual(["npm test", "npm run build"]);
    });
  });

  describe("editing a command", () => {
    it("persists an edited command to config", async () => {
      const { stdin } = renderAllowedCommands();
      // Navigate to first item (down wraps from add row to item 0)
      await stdin.write(keys.down);
      await stdin.write(" --watch");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.allowedCommands).toContain("npm test --watch");
    });
  });

  describe("removing a command", () => {
    it("persists removal to config on enter when empty", async () => {
      const { stdin } = renderAllowedCommands();
      // Navigate to first item
      await stdin.write(keys.down);
      // Clear "npm test" (8 chars) then enter to remove
      for (let i = 0; i < 8; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.allowedCommands).toEqual(["npm run build"]);
    });
  });

  describe("navigation", () => {
    it("calls onBack on escape", async () => {
      const { stdin, onBack } = renderAllowedCommands();
      await stdin.write(keys.escape);
      expect(onBack).toHaveBeenCalled();
    });
  });
});
