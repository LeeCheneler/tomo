import { afterEach, describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { Settings } from "./settings";

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

  /** Renders Settings with a spy onDone callback and fixed terminal width. */
  function renderSettings() {
    setColumns(COLUMNS);
    const onDone = vi.fn();
    const result = renderInk(<Settings onDone={onDone} />);
    return { ...result, onDone };
  }

  describe("menu", () => {
    it("renders borders and heading", () => {
      const { lastFrame } = renderSettings();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Settings");
    });

    it("renders all menu items", () => {
      const { lastFrame } = renderSettings();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Providers");
      expect(frame).toContain("Permissions");
      expect(frame).toContain("Allowed Commands");
      expect(frame).toContain("Tools");
      expect(frame).toContain("MCP Servers");
      expect(frame).toContain("Skill Sets");
    });

    it("shows the first item selected by default", () => {
      const { lastFrame } = renderSettings();
      expect(lastFrame()).toContain("❯ Providers");
    });

    it("moves selection down", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Permissions");
    });

    it("moves selection up", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ Permissions");
    });

    it("clamps selection at top", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ Providers");
    });

    it("clamps selection at bottom", async () => {
      const { stdin, lastFrame } = renderSettings();
      for (let i = 0; i < 10; i++) {
        await stdin.write(keys.down);
      }
      expect(lastFrame()).toContain("❯ Skill Sets");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderSettings();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("navigate");
      expect(frame).toContain("select");
      expect(frame).toContain("exit");
    });

    it("calls onDone with no result on escape", async () => {
      const { stdin, onDone } = renderSettings();
      await stdin.write(keys.escape);
      expect(onDone).toHaveBeenCalledWith();
    });

    it("ignores unhandled keys", async () => {
      const { stdin, lastFrame, onDone } = renderSettings();
      await stdin.write("x");
      expect(onDone).not.toHaveBeenCalled();
      expect(lastFrame()).toContain("❯ Providers");
    });
  });

  describe("sub-screens", () => {
    it("enters a sub-screen on enter", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Providers");
      expect(frame).toContain("Coming soon");
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
      expect(frame).toContain("❯ Providers");
      expect(frame).toContain("Permissions");
    });

    it("does not call onDone when escaping sub-screen", async () => {
      const { stdin, onDone } = renderSettings();
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onDone).not.toHaveBeenCalled();
    });

    it("enters the correct sub-screen based on cursor position", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Allowed Commands");
      expect(frame).toContain("Coming soon");
    });

    it("shows back instruction in sub-screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("back");
    });

    it("ignores non-escape keys in sub-screen", async () => {
      const { stdin, lastFrame } = renderSettings();
      await stdin.write(keys.enter);
      await stdin.write("x");
      await stdin.write(keys.up);
      await stdin.write(keys.down);
      // Still on the sub-screen
      expect(lastFrame()).toContain("Coming soon");
    });
  });
});
