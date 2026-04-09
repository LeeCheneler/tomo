import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { KvEditor } from "./kv-editor";

/** Renders KvEditor with sensible defaults and a spied onExit. */
function renderKvEditor(
  entries: Record<string, string> = {},
  placeholder?: string,
) {
  const onExit = vi.fn();
  const result = renderInk(
    <KvEditor entries={entries} onExit={onExit} placeholder={placeholder} />,
  );
  return { ...result, onExit };
}

describe("KvEditor", () => {
  describe("rendering", () => {
    it("renders all entries and the add row", () => {
      const { lastFrame } = renderKvEditor({ FOO: "bar", BAZ: "qux" });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("FOO=bar");
      expect(frame).toContain("BAZ=qux");
      expect(frame).toContain("Add entry...");
    });

    it("shows cursor on the add row by default", () => {
      const { lastFrame } = renderKvEditor({ FOO: "bar" });
      const frame = lastFrame() ?? "";
      const addLine = frame.split("\n").find((l) => l.includes("Add entry..."));
      expect(addLine).toContain("❯");
    });

    it("uses a custom placeholder", () => {
      const { lastFrame } = renderKvEditor({}, "Add header...");
      expect(lastFrame()).toContain("Add header...");
    });

    it("renders empty when no entries are provided", () => {
      const { lastFrame } = renderKvEditor({});
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Add entry...");
      expect(frame).toContain("❯");
    });
  });

  describe("adding entries", () => {
    it("adds a valid row on enter", async () => {
      const { stdin, lastFrame } = renderKvEditor();
      await stdin.write("FOO=bar");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("FOO=bar");
    });

    it("clears the draft after adding", async () => {
      const { stdin, lastFrame } = renderKvEditor();
      await stdin.write("FOO=bar");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      // Add row should now be empty/placeholder again.
      expect(frame).toContain("Add entry...");
    });

    it("does nothing when enter is pressed on an empty add row", async () => {
      const { stdin, onExit } = renderKvEditor();
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({});
    });

    it("can add multiple entries in sequence", async () => {
      const { stdin, onExit } = renderKvEditor();
      await stdin.write("FOO=1");
      await stdin.write(keys.enter);
      await stdin.write("BAR=2");
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "1", BAR: "2" });
    });
  });

  describe("validation warnings", () => {
    it("shows an invalid warning on a row missing =", async () => {
      const { stdin, lastFrame } = renderKvEditor();
      await stdin.write("NO_EQUALS_HERE");
      expect(lastFrame()).toContain("invalid: missing =");
    });

    it("shows a duplicate warning on the earlier of two same-key rows", async () => {
      const { stdin, lastFrame } = renderKvEditor({ FOO: "first" });
      // Move to add row, type a row with the same key
      await stdin.write("FOO=second");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("FOO=first");
      expect(frame).toContain("duplicate, will be dropped");
    });

    it("does not warn on the most recent occurrence of a duplicate key", async () => {
      const { stdin, lastFrame } = renderKvEditor({ FOO: "first" });
      await stdin.write("FOO=second");
      const frame = lastFrame() ?? "";
      // Find the line with the second value — it must NOT carry the duplicate
      // suffix. We rely on the fact that the warning text only appears once.
      const warningCount = (frame.match(/duplicate, will be dropped/g) ?? [])
        .length;
      expect(warningCount).toBe(1);
    });
  });

  describe("editing existing rows", () => {
    it("loads the row's value into the draft when navigated to", async () => {
      const { stdin, lastFrame } = renderKvEditor({ FOO: "bar" });
      await stdin.write(keys.up);
      await stdin.write("X");
      expect(lastFrame()).toContain("FOO=barX");
    });

    it("commits an edit on enter", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "bar" });
      await stdin.write(keys.up);
      await stdin.write("X");
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "barX" });
    });

    it("removes a row when its draft is cleared and enter is pressed", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "bar", BAZ: "qux" });
      // Cursor starts on add row; navigate up to the second item (BAZ=qux)
      await stdin.write(keys.up);
      // Clear the draft
      for (let i = 0; i < "BAZ=qux".length; i++) {
        await stdin.write(keys.delete);
      }
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "bar" });
    });
  });

  describe("navigation", () => {
    it("preserves edits when moving between rows", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "1", BAR: "2" });
      // Go to BAR row, edit it, then move away and come back
      await stdin.write(keys.up);
      await stdin.write("X");
      await stdin.write(keys.up); // to FOO
      await stdin.write(keys.down); // back to BAR
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "1", BAR: "2X" });
    });

    it("loops cursor from add row up through existing rows", async () => {
      const { stdin, lastFrame } = renderKvEditor({ FOO: "bar" });
      await stdin.write(keys.up);
      // Cursor should now be on the FOO row
      const frame = lastFrame() ?? "";
      const fooLine = frame.split("\n").find((l) => l.includes("FOO=bar"));
      expect(fooLine).toContain("❯");
    });

    it("navigates from an existing row down to the add row", async () => {
      const { stdin, lastFrame } = renderKvEditor({ FOO: "bar" });
      // Up to FOO
      await stdin.write(keys.up);
      // Down back to the add row — exercises focusRow at index === rows.length
      await stdin.write(keys.down);
      const addLine = (lastFrame() ?? "")
        .split("\n")
        .find((l) => l.includes("Add entry..."));
      expect(addLine).toContain("❯");
    });

    it("wraps down from the add row to row 0", async () => {
      const { stdin, lastFrame } = renderKvEditor({ FOO: "bar" });
      // Cursor starts on the add row (index 1). Down wraps to row 0.
      await stdin.write(keys.down);
      const fooLine = (lastFrame() ?? "")
        .split("\n")
        .find((l) => l.includes("FOO=bar"));
      expect(fooLine).toContain("❯");
    });
  });

  describe("ignored keys", () => {
    it("leaves state unchanged for keys that processTextEdit does not handle", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "bar" });
      // ctrl+a falls through all of kv-editor's handled keys and reaches
      // processTextEdit, which returns null for ctrl-prefixed keys.
      await stdin.write(keys.ctrlA);
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "bar" });
    });
  });

  describe("deleting non-last rows", () => {
    it("slides the next row up when deleting a non-last row", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "1", BAR: "2" });
      // Cursor starts on the add row (index 2). Navigate up twice to FOO (index 0).
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Clear the draft ("FOO=1" is 5 chars)
      for (let i = 0; i < "FOO=1".length; i++) {
        await stdin.write(keys.delete);
      }
      // Enter removes FOO; BAR slides up into index 0 and the draft loads its value.
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ BAR: "2" });
    });
  });

  describe("exiting with an empty draft on an existing row", () => {
    it("drops the row from the result", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "bar" });
      // Up to FOO
      await stdin.write(keys.up);
      // Clear the draft ("FOO=bar" is 7 chars)
      for (let i = 0; i < "FOO=bar".length; i++) {
        await stdin.write(keys.delete);
      }
      // Escape without pressing enter — the unsaved empty draft is applied
      // to the row on exit, and buildRecord drops it because it won't parse.
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({});
    });
  });

  describe("exiting", () => {
    it("calls onExit with the cleaned record on escape", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "bar" });
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "bar" });
    });

    it("calls onExit with the cleaned record on tab", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "bar" });
      await stdin.write(keys.tab);
      expect(onExit).toHaveBeenCalledWith({ FOO: "bar" });
    });

    it("drops invalid rows on exit", async () => {
      const { stdin, onExit } = renderKvEditor();
      await stdin.write("VALID=ok");
      await stdin.write(keys.enter);
      await stdin.write("invalid_no_equals");
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ VALID: "ok" });
    });

    it("applies last-write-wins for duplicate keys on exit", async () => {
      const { stdin, onExit } = renderKvEditor({ FOO: "first" });
      await stdin.write("FOO=second");
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "second" });
    });

    it("includes the unsaved draft on the current row when exiting", async () => {
      const { stdin, onExit } = renderKvEditor();
      // Type into the add row, then exit without pressing enter.
      await stdin.write("FOO=bar");
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({ FOO: "bar" });
    });

    it("emits an empty record when the editor has no valid rows", async () => {
      const { stdin, onExit } = renderKvEditor();
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledWith({});
    });
  });
});
