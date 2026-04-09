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

  describe("maxVisible", () => {
    const LONG_ITEMS: SelectListItem[] = Array.from({ length: 10 }, (_, i) => ({
      key: `item-${i}`,
      label: `Item ${i}`,
    }));

    /** Renders SelectList with maxVisible and spy callbacks. */
    function renderWindowed(maxVisible: number) {
      const onSelect = vi.fn();
      const onExit = vi.fn();
      const result = renderInk(
        <SelectList
          items={LONG_ITEMS}
          onSelect={onSelect}
          onExit={onExit}
          maxVisible={maxVisible}
        />,
      );
      return { ...result, onSelect, onExit };
    }

    it("renders only the first maxVisible items on mount", () => {
      const { lastFrame } = renderWindowed(3);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Item 0");
      expect(frame).toContain("Item 1");
      expect(frame).toContain("Item 2");
      expect(frame).not.toContain("Item 3");
      expect(frame).not.toContain("Item 9");
    });

    it("shows the hidden-below count when items overflow", () => {
      const { lastFrame } = renderWindowed(3);
      expect(lastFrame()).toContain("↓ 7 more");
    });

    it("does not show any overflow indicators when at the top", () => {
      const { lastFrame } = renderWindowed(3);
      expect(lastFrame()).not.toContain("↑");
    });

    it("scrolls the window down when the cursor reaches the bottom edge", async () => {
      const { stdin, lastFrame } = renderWindowed(3);
      // Cursor starts at 0. Move down 3 times — the third move scrolls.
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯ Item 3");
      expect(frame).toContain("Item 1");
      expect(frame).toContain("Item 2");
      expect(frame).not.toContain("Item 0");
      expect(frame).toContain("↑ 1 more");
      expect(frame).toContain("↓ 6 more");
    });

    it("scrolls the window up when the cursor moves back above the top edge", async () => {
      const { stdin, lastFrame } = renderWindowed(3);
      // Scroll down first: cursor 0 → 3
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      // Now scrolled: visible Items 1-3, cursor on 3.
      // Move up twice — cursor=1, still visible. Move up again — cursor=0, scrolls up.
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯ Item 0");
      expect(frame).not.toContain("↑");
    });

    it("wraps cursor and scroll window from top to bottom on up-arrow", async () => {
      const { stdin, lastFrame } = renderWindowed(3);
      // Cursor at 0. Up arrow wraps to 9.
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯ Item 9");
      expect(frame).toContain("Item 7");
      expect(frame).toContain("Item 8");
      expect(frame).toContain("↑ 7 more");
      expect(frame).not.toContain("↓");
    });

    it("wraps cursor and scroll window from bottom to top on down-arrow", async () => {
      const { stdin, lastFrame } = renderWindowed(3);
      // Navigate to the last item (cursor 9) then press down to wrap.
      for (let i = 0; i < 9; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯ Item 0");
      expect(frame).not.toContain("↑");
    });

    it("renders all items without indicators when items fit within maxVisible", () => {
      const onSelect = vi.fn();
      const onExit = vi.fn();
      const { lastFrame } = renderInk(
        <SelectList
          items={LONG_ITEMS.slice(0, 3)}
          onSelect={onSelect}
          onExit={onExit}
          maxVisible={5}
        />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Item 0");
      expect(frame).toContain("Item 1");
      expect(frame).toContain("Item 2");
      expect(frame).not.toContain("↑");
      expect(frame).not.toContain("↓");
    });

    it("selects the correct item after scrolling", async () => {
      const { stdin, onSelect } = renderWindowed(3);
      // Scroll down so cursor lands on Item 5, then select.
      for (let i = 0; i < 5; i++) {
        await stdin.write(keys.down);
      }
      await stdin.write(keys.enter);
      expect(onSelect).toHaveBeenCalledWith(LONG_ITEMS[5]);
    });
  });
});
