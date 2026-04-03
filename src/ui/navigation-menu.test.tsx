import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { NavigationMenuItem } from "./navigation-menu";
import { NavigationMenu } from "./navigation-menu";

const ITEMS: NavigationMenuItem[] = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Bravo" },
  { key: "c", label: "Charlie" },
];

describe("NavigationMenu", () => {
  /** Renders NavigationMenu with spy callbacks. */
  function renderMenu(
    items: readonly NavigationMenuItem[] = ITEMS,
    color?: string,
  ) {
    const onSelect = vi.fn();
    const onExit = vi.fn();
    const result = renderInk(
      <NavigationMenu
        items={items}
        onSelect={onSelect}
        onExit={onExit}
        color={color}
      />,
    );
    return { ...result, onSelect, onExit };
  }

  describe("rendering", () => {
    it("renders all item labels", () => {
      const { lastFrame } = renderMenu();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Alpha");
      expect(frame).toContain("Bravo");
      expect(frame).toContain("Charlie");
    });

    it("shows cursor on the first item by default", () => {
      const { lastFrame } = renderMenu();
      expect(lastFrame()).toContain("❯ Alpha");
    });

    it("renders empty when no items provided", () => {
      const { lastFrame } = renderMenu([]);
      expect(lastFrame()).toBe("");
    });
  });

  describe("navigation", () => {
    it("moves cursor down", async () => {
      const { stdin, lastFrame } = renderMenu();
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Bravo");
    });

    it("moves cursor up", async () => {
      const { stdin, lastFrame } = renderMenu();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ Bravo");
    });

    it("clamps cursor at the top", async () => {
      const { stdin, lastFrame } = renderMenu();
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ Alpha");
    });

    it("clamps cursor at the bottom", async () => {
      const { stdin, lastFrame } = renderMenu();
      for (let i = 0; i < 10; i++) {
        await stdin.write(keys.down);
      }
      expect(lastFrame()).toContain("❯ Charlie");
    });

    it("navigates through all items sequentially", async () => {
      const { stdin, lastFrame } = renderMenu();
      expect(lastFrame()).toContain("❯ Alpha");
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Bravo");
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Charlie");
    });
  });

  describe("selection", () => {
    it("calls onSelect with the first item on enter", async () => {
      const { stdin, onSelect } = renderMenu();
      await stdin.write(keys.enter);
      expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
    });

    it("calls onSelect with the navigated item", async () => {
      const { stdin, onSelect } = renderMenu();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      expect(onSelect).toHaveBeenCalledWith(ITEMS[2]);
    });
  });

  describe("exit", () => {
    it("calls onExit on escape", async () => {
      const { stdin, onExit } = renderMenu();
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledOnce();
    });

    it("does not call onSelect on escape", async () => {
      const { stdin, onSelect } = renderMenu();
      await stdin.write(keys.escape);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("unhandled keys", () => {
    it("ignores printable characters", async () => {
      const { stdin, lastFrame, onSelect, onExit } = renderMenu();
      await stdin.write("x");
      expect(lastFrame()).toContain("❯ Alpha");
      expect(onSelect).not.toHaveBeenCalled();
      expect(onExit).not.toHaveBeenCalled();
    });
  });
});
