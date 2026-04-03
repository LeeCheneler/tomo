import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { ToggleListItem } from "./toggle-list";
import { ToggleList } from "./toggle-list";

const ITEMS: ToggleListItem[] = [
  { key: "a", label: "Alpha", value: true },
  { key: "b", label: "Bravo", value: false },
  { key: "c", label: "Charlie", value: true },
];

describe("ToggleList", () => {
  /** Renders ToggleList with spy callbacks. */
  function renderToggleList(
    items: readonly ToggleListItem[] = ITEMS,
    color?: string,
  ) {
    const onToggle = vi.fn();
    const onExit = vi.fn();
    const result = renderInk(
      <ToggleList
        items={items}
        onToggle={onToggle}
        onExit={onExit}
        color={color}
      />,
    );
    return { ...result, onToggle, onExit };
  }

  describe("rendering", () => {
    it("renders all item labels", () => {
      const { lastFrame } = renderToggleList();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Alpha");
      expect(frame).toContain("Bravo");
      expect(frame).toContain("Charlie");
    });

    it("shows cursor on the first item by default", () => {
      const { lastFrame } = renderToggleList();
      expect(lastFrame()).toContain("❯ [✓] Alpha");
    });

    it("shows checked indicator for enabled items", () => {
      const { lastFrame } = renderToggleList();
      expect(lastFrame()).toContain("[✓] Alpha");
      expect(lastFrame()).toContain("[✓] Charlie");
    });

    it("shows unchecked indicator for disabled items", () => {
      const { lastFrame } = renderToggleList();
      expect(lastFrame()).toContain("[ ] Bravo");
    });

    it("renders empty when no items provided", () => {
      const { lastFrame } = renderToggleList([]);
      expect(lastFrame()).toBe("");
    });
  });

  describe("navigation", () => {
    it("moves cursor down", async () => {
      const { stdin, lastFrame } = renderToggleList();
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ [ ] Bravo");
    });

    it("moves cursor up", async () => {
      const { stdin, lastFrame } = renderToggleList();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ [ ] Bravo");
    });

    it("loops from top to bottom on up", async () => {
      const { stdin, lastFrame } = renderToggleList();
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ [✓] Charlie");
    });

    it("loops from bottom to top on down", async () => {
      const { stdin, lastFrame } = renderToggleList();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ [✓] Alpha");
    });
  });

  describe("toggling", () => {
    it("calls onToggle with inverted value on enter", async () => {
      const { stdin, onToggle } = renderToggleList();
      await stdin.write(keys.enter);
      expect(onToggle).toHaveBeenCalledWith("a", false);
    });

    it("calls onToggle with inverted value on space", async () => {
      const { stdin, onToggle } = renderToggleList();
      await stdin.write(" ");
      expect(onToggle).toHaveBeenCalledWith("a", false);
    });

    it("toggles the navigated item", async () => {
      const { stdin, onToggle } = renderToggleList();
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      expect(onToggle).toHaveBeenCalledWith("b", true);
    });

    it("toggles enabled item to disabled", async () => {
      const { stdin, onToggle } = renderToggleList();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(" ");
      expect(onToggle).toHaveBeenCalledWith("c", false);
    });
  });

  describe("exit", () => {
    it("calls onExit on escape", async () => {
      const { stdin, onExit } = renderToggleList();
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledOnce();
    });

    it("does not call onToggle on escape", async () => {
      const { stdin, onToggle } = renderToggleList();
      await stdin.write(keys.escape);
      expect(onToggle).not.toHaveBeenCalled();
    });
  });

  describe("unhandled keys", () => {
    it("ignores printable characters other than space", async () => {
      const { stdin, lastFrame, onToggle, onExit } = renderToggleList();
      await stdin.write("x");
      expect(lastFrame()).toContain("❯ [✓] Alpha");
      expect(onToggle).not.toHaveBeenCalled();
      expect(onExit).not.toHaveBeenCalled();
    });
  });
});
