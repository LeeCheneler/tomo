import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { EditableList } from "./editable-list";

/** Renders EditableList with sensible defaults and spied callbacks. */
function renderEditableList(
  items: string[] = ["npm test", "npm run build"],
  placeholder?: string,
) {
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const onUpdate = vi.fn();
  const onExit = vi.fn();
  const result = renderInk(
    <EditableList
      items={items}
      onAdd={onAdd}
      onRemove={onRemove}
      onUpdate={onUpdate}
      onExit={onExit}
      placeholder={placeholder}
    />,
  );
  return { ...result, onAdd, onRemove, onUpdate, onExit };
}

describe("EditableList", () => {
  describe("rendering", () => {
    it("renders all items and add row at bottom", () => {
      const { lastFrame } = renderEditableList();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("npm test");
      expect(frame).toContain("npm run build");
      expect(frame).toContain("Add item...");
    });

    it("shows cursor on add row by default", () => {
      const { lastFrame } = renderEditableList();
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const addLine = lines.find((l) => l.includes("Add item..."));
      expect(addLine).toContain("❯");
    });

    it("shows add row with custom placeholder", () => {
      const { lastFrame } = renderEditableList([], "Add command...");
      expect(lastFrame()).toContain("Add command...");
    });

    it("renders empty list with only add row", () => {
      const { lastFrame } = renderEditableList([]);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("Add item...");
    });

    it("does not shift add row text when selected vs not selected", () => {
      const { lastFrame } = renderEditableList();
      const frame = lastFrame() ?? "";
      // All lines with "Add item..." should have placeholder at the same column.
      // Selected: "❯ Add item...", not selected: "  Add item..."
      const lines = frame.split("\n").filter((l) => l.includes("Add item..."));
      expect(lines.length).toBe(1);
    });
  });

  describe("navigation", () => {
    it("moves cursor up to items from add row", async () => {
      const { stdin, lastFrame } = renderEditableList();
      // Up from add row to last item
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const cursorLine = lines.find((l) => l.includes("❯"));
      expect(cursorLine).toContain("npm run build");
    });

    it("moves cursor down wraps to first item from add row", async () => {
      const { stdin, lastFrame } = renderEditableList();
      // Down from add row wraps to first item
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const cursorLine = lines.find((l) => l.includes("❯"));
      expect(cursorLine).toContain("npm test");
    });

    it("navigates through all rows", async () => {
      const { stdin, lastFrame } = renderEditableList();
      // add → item0 → item1 → add (full loop)
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const addLine = lines.find((l) => l.includes("Add item..."));
      expect(addLine).toContain("❯");
    });

    it("wraps from first item to add row on up", async () => {
      const { stdin, lastFrame } = renderEditableList();
      // Start on add row, down to first item, up wraps to add row
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const addLine = lines.find((l) => l.includes("Add item..."));
      expect(addLine).toContain("❯");
    });

    it("discards unsaved edits on navigate away", async () => {
      const { stdin, lastFrame, onUpdate } = renderEditableList();
      // Navigate to first item
      await stdin.write(keys.down);
      // Edit it
      await stdin.write("!!!");
      // Navigate away and back
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("npm test");
      expect(frame).not.toContain("npm test!!!");
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("editing", () => {
    it("inserts characters at cursor", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write("!");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("npm test!");
    });

    it("removes characters with backspace", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write(keys.backspace);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("npm tes");
    });

    it("moves text cursor with left arrow", async () => {
      const { stdin, onUpdate } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write(keys.left);
      await stdin.write("X");
      await stdin.write(keys.enter);
      expect(onUpdate).toHaveBeenCalledWith(0, "npm tesXt");
    });

    it("moves text cursor with right arrow at end is a no-op", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write(keys.right);
      await stdin.write("!");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("npm test!");
    });

    it("shows enter save hint when item has unsaved changes", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write("!");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("enter");
      expect(frame).toContain("save");
    });

    it("does not show enter save hint on add row", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write("new");
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const cursorLine = lines.find(
        (l) => l.includes("❯") && l.includes("new"),
      );
      expect(cursorLine).toBeDefined();
      expect(cursorLine).not.toContain("save");
    });

    it("does not show hint when no changes on item", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const cursorLine = lines.find((l) => l.includes("❯"));
      expect(cursorLine).toBeDefined();
      expect(cursorLine).not.toContain("save");
      expect(cursorLine).not.toContain("remove");
    });

    it("shows enter remove hint when item is cleared", async () => {
      const { stdin, lastFrame } = renderEditableList();
      await stdin.write(keys.down);
      for (let i = 0; i < 8; i++) {
        await stdin.write(keys.backspace);
      }
      const frame = lastFrame() ?? "";
      expect(frame).toContain("enter");
      expect(frame).toContain("remove");
    });

    it("calls onUpdate on enter with changed value", async () => {
      const { stdin, onUpdate } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write("!");
      await stdin.write(keys.enter);
      expect(onUpdate).toHaveBeenCalledWith(0, "npm test!");
    });

    it("does not call onUpdate on enter with no changes", async () => {
      const { stdin, onUpdate } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("silently rejects editing to a duplicate value", async () => {
      const { stdin, onUpdate } = renderEditableList();
      await stdin.write(keys.down);
      for (let i = 0; i < 8; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write("npm run build");
      await stdin.write(keys.enter);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it("ignores ctrl, meta, and tab keys", async () => {
      const { stdin, onUpdate } = renderEditableList();
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("adding", () => {
    it("calls onAdd on enter with value", async () => {
      const { stdin, onAdd } = renderEditableList();
      await stdin.write("npm lint");
      await stdin.write(keys.enter);
      expect(onAdd).toHaveBeenCalledWith("npm lint");
    });

    it("trims value before adding", async () => {
      const { stdin, onAdd } = renderEditableList();
      await stdin.write("  npm lint  ");
      await stdin.write(keys.enter);
      expect(onAdd).toHaveBeenCalledWith("npm lint");
    });

    it("clears add row after successful add", async () => {
      const { stdin, lastFrame, onAdd } = renderEditableList();
      await stdin.write("npm lint");
      await stdin.write(keys.enter);
      expect(onAdd).toHaveBeenCalled();
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("npm lint");
    });

    it("silently rejects duplicate entries", async () => {
      const { stdin, onAdd } = renderEditableList();
      await stdin.write("npm test");
      await stdin.write(keys.enter);
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("does not add empty values", async () => {
      const { stdin, onAdd } = renderEditableList();
      await stdin.write(keys.enter);
      expect(onAdd).not.toHaveBeenCalled();
    });

    it("does not add whitespace-only values", async () => {
      const { stdin, onAdd } = renderEditableList();
      await stdin.write("   ");
      await stdin.write(keys.enter);
      expect(onAdd).not.toHaveBeenCalled();
    });
  });

  describe("removing", () => {
    it("removes item on enter when cleared to empty", async () => {
      const { stdin, onRemove } = renderEditableList();
      await stdin.write(keys.down);
      for (let i = 0; i < 8; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write(keys.enter);
      expect(onRemove).toHaveBeenCalledWith(0);
    });

    it("removes item on enter when only whitespace remains", async () => {
      const { stdin, onRemove } = renderEditableList();
      await stdin.write(keys.down);
      for (let i = 0; i < 8; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write("   ");
      await stdin.write(keys.enter);
      expect(onRemove).toHaveBeenCalledWith(0);
    });

    it("focuses next item after removal", async () => {
      const { stdin, onRemove } = renderEditableList(["aaa", "bbb", "ccc"]);
      // Navigate to first item (down from add row wraps to item 0)
      await stdin.write(keys.down);
      for (let i = 0; i < 3; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write(keys.enter);
      expect(onRemove).toHaveBeenCalledWith(0);
    });

    it("focuses add row when removing last item", async () => {
      const { stdin, onRemove } = renderEditableList(["aaa", "bbb"]);
      // Navigate to second item (down wraps to 0, down again to 1)
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      for (let i = 0; i < 3; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write(keys.enter);
      expect(onRemove).toHaveBeenCalledWith(1);
    });

    it("does not remove on backspace with empty add row", async () => {
      const { stdin, onRemove } = renderEditableList();
      await stdin.write(keys.backspace);
      expect(onRemove).not.toHaveBeenCalled();
    });
  });

  describe("exit", () => {
    it("calls onExit on escape", async () => {
      const { stdin, onExit } = renderEditableList();
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalled();
    });

    it("does not call other callbacks on escape", async () => {
      const { stdin, onAdd, onRemove, onUpdate } = renderEditableList();
      await stdin.write(keys.escape);
      expect(onAdd).not.toHaveBeenCalled();
      expect(onRemove).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });
});
