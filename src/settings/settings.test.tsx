import { afterEach, describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { Settings } from "./settings";

vi.mock("../skill-sets/git", () => ({
  cloneSource: vi.fn(),
  pullSource: vi.fn(),
  removeSource: vi.fn(),
}));

vi.mock("../skill-sets/loader", () => ({
  discoverSkillSets: vi.fn(() => []),
}));

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("Settings", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders Settings with a spy onDone callback, mocked config, and fixed terminal width. */
  function renderSettings() {
    setColumns(COLUMNS);
    const onDone = vi.fn();
    return { ...renderInk(<Settings onDone={onDone} />), onDone };
  }

  describe("menu", () => {
    it("renders borders, heading, and all menu items", () => {
      const { lastFrame } = renderSettings();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Settings");
      expect(frame).toContain("Providers");
      expect(frame).toContain("Permissions");
      expect(frame).toContain("Allowed Commands");
      expect(frame).toContain("Tools");
      expect(frame).toContain("MCP Servers");
      expect(frame).toContain("Skill Sets");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderSettings();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("select");
      expect(frame).toContain("exit");
    });

    it("calls onDone with settings updated message on escape", async () => {
      const { stdin, onDone } = renderSettings();
      await stdin.write(keys.escape);
      expect(onDone).toHaveBeenCalledWith("Settings updated");
    });
  });

  describe("sub-screens", () => {
    it("enters a sub-screen on enter", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Providers");
      expect(frame).not.toContain("Coming soon");
    });

    it("renders borders in sub-screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("─".repeat(COLUMNS));
    });

    it("returns to menu on escape from sub-screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Settings");
      expect(frame).toContain("Providers");
      expect(frame).toContain("Permissions");
    });

    it("does not call onDone when escaping sub-screen", async () => {
      const { stdin, onDone } = renderSettings();
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onDone).not.toHaveBeenCalled();
    });

    it("enters the MCP servers screen on selection", async () => {
      const { stdin, lastFrame } = renderSettings();
      // Navigate to MCP Servers (5th item, index 4)
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("MCP Servers");
      expect(frame).toContain("Add server...");
    });

    it("shows back instruction in sub-screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("back");
    });

    it("returns to menu on escape from a sub-screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      // Navigate into MCP Servers
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(lastFrame()).toContain("Settings");
    });
  });

  describe("permissions screen", () => {
    it("enters the permissions screen instead of placeholder", async () => {
      const { stdin, lastFrame } = renderSettings();
      // Navigate to Permissions (second item)
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Permissions");
      expect(frame).toContain("Read files (current directory)");
      expect(frame).not.toContain("Coming soon");
    });

    it("returns to menu from permissions screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Settings");
      expect(frame).toContain("Providers");
    });
  });

  describe("tools screen", () => {
    it("enters the tools screen instead of placeholder", async () => {
      const { stdin, lastFrame } = renderSettings();
      // Navigate to Tools (fourth item)
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Tools");
      expect(frame).toContain("Agent");
      expect(frame).not.toContain("Coming soon");
    });

    it("returns to menu from tools screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Settings");
      expect(frame).toContain("Providers");
    });
  });

  describe("allowed commands screen", () => {
    it("enters the allowed commands screen instead of placeholder", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Allowed Commands");
      expect(frame).not.toContain("Coming soon");
    });

    it("returns to menu from allowed commands screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Settings");
      expect(frame).toContain("Providers");
    });
  });

  describe("skill sets screen", () => {
    it("enters the skill sets screen instead of placeholder", async () => {
      const { stdin, lastFrame } = renderSettings();
      // Skill Sets is the 6th menu item (5 downs from top)
      for (let i = 0; i < 5; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Skill Sets");
      expect(frame).toContain("Add source...");
      expect(frame).not.toContain("Coming soon");
    });

    it("returns to menu from skill sets screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      for (let i = 0; i < 5; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Settings");
      expect(frame).toContain("Providers");
    });
  });

  describe("exit message", () => {
    it("always calls onDone with settings updated message", async () => {
      const { stdin, onDone } = renderSettings();
      // Enter permissions, go back, exit
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      await stdin.write(keys.escape);
      expect(onDone).toHaveBeenCalledWith("Settings updated");
    });
  });
});
