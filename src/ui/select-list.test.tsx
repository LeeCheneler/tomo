import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { SelectListItem } from "./select-list";
import { SelectList } from "./select-list";

const ITEMS: SelectListItem[] = [
  { key: "a", label: "Alpha" },
  { key: "b", label: "Bravo" },
  { key: "c", label: "Charlie" },
];

describe("SelectList", () => {
  /** Renders SelectList with spy callbacks. */
  function renderList(
    items: readonly SelectListItem[] = ITEMS,
    color?: string,
  ) {
    const onSelect = vi.fn();
    const onExit = vi.fn();
    const result = renderInk(
      <SelectList
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
      const { lastFrame } = renderList();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Alpha");
      expect(frame).toContain("Bravo");
      expect(frame).toContain("Charlie");
    });

    it("shows cursor on the first item by default", () => {
      const { lastFrame } = renderList();
      expect(lastFrame()).toContain("❯ Alpha");
    });

    it("renders empty when no items provided", () => {
      const { lastFrame } = renderList([]);
      expect(lastFrame()).toBe("");
    });
  });

  describe("navigation", () => {
    it("moves cursor down", async () => {
      const { stdin, lastFrame } = renderList();
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Bravo");
    });

    it("moves cursor up", async () => {
      const { stdin, lastFrame } = renderList();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ Bravo");
    });

    it("loops from top to bottom on up", async () => {
      const { stdin, lastFrame } = renderList();
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯ Charlie");
    });

    it("loops from bottom to top on down", async () => {
      const { stdin, lastFrame } = renderList();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Alpha");
    });

    it("navigates through all items sequentially", async () => {
      const { stdin, lastFrame } = renderList();
      expect(lastFrame()).toContain("❯ Alpha");
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Bravo");
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Charlie");
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯ Alpha");
    });
  });

  describe("selection", () => {
    it("calls onSelect with the first item on enter", async () => {
      const { stdin, onSelect } = renderList();
      await stdin.write(keys.enter);
      expect(onSelect).toHaveBeenCalledWith(ITEMS[0]);
    });

    it("calls onSelect with the navigated item", async () => {
      const { stdin, onSelect } = renderList();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      expect(onSelect).toHaveBeenCalledWith(ITEMS[2]);
    });
  });

  describe("exit", () => {
    it("calls onExit on escape", async () => {
      const { stdin, onExit } = renderList();
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledOnce();
    });

    it("does not call onSelect on escape", async () => {
      const { stdin, onSelect } = renderList();
      await stdin.write(keys.escape);
      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("unhandled keys", () => {
    it("ignores printable characters", async () => {
      const { stdin, lastFrame, onSelect, onExit } = renderList();
      await stdin.write("x");
      expect(lastFrame()).toContain("❯ Alpha");
      expect(onSelect).not.toHaveBeenCalled();
      expect(onExit).not.toHaveBeenCalled();
    });
  });
});
