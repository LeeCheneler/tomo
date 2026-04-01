import { afterEach, describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { MessageHistory } from "./message-history";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("MessageHistory", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders MessageHistory with sensible defaults and a fixed terminal width. */
  function renderHistory(
    overrides: Partial<{
      entries: string[];
      onSelected: (entry: string) => void;
      onExit: () => void;
    }> = {},
  ) {
    setColumns(COLUMNS);

    return renderInk(
      <MessageHistory
        entries={overrides.entries ?? ["first", "second", "third"]}
        onSelected={overrides.onSelected ?? (() => {})}
        onExit={overrides.onExit ?? (() => {})}
      />,
    );
  }

  describe("layout", () => {
    it("renders borders at full terminal width", () => {
      const { lastFrame } = renderHistory();
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      // paddingTop={1} adds an empty line before the border.
      expect(lines[1]).toBe("─".repeat(COLUMNS));
    });

    it("displays the last entry by default", () => {
      const { lastFrame } = renderHistory();
      expect(lastFrame()).toContain("third");
    });

    it("renders the prompt marker", () => {
      const { lastFrame } = renderHistory();
      expect(lastFrame()).toContain("❯");
    });

    it("falls back to 80 columns when stdout.columns is undefined", () => {
      setColumns(undefined);

      const { lastFrame } = renderInk(
        <MessageHistory
          entries={["hello"]}
          onSelected={() => {}}
          onExit={() => {}}
        />,
      );

      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      expect(lines[1]).toBe("─".repeat(80));
    });
  });

  describe("navigation", () => {
    it("navigates to previous entry on up arrow", async () => {
      const { stdin, lastFrame } = renderHistory();
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("second");
    });

    it("navigates to next entry on down arrow", async () => {
      const { stdin, lastFrame } = renderHistory();
      await stdin.write(keys.up);
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("third");
    });

    it("does not navigate past the first entry", async () => {
      const { stdin, lastFrame } = renderHistory();
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("first");
    });

    it("ignores unhandled keys", async () => {
      const onExit = vi.fn();
      const onSelected = vi.fn();
      const { stdin, lastFrame } = renderHistory({ onExit, onSelected });
      await stdin.write("x");
      expect(lastFrame()).toContain("third");
      expect(onExit).not.toHaveBeenCalled();
      expect(onSelected).not.toHaveBeenCalled();
    });

    it("navigates down through middle entries without exiting", async () => {
      const onExit = vi.fn();
      const { stdin, lastFrame } = renderHistory({ onExit });
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("second");
      expect(onExit).not.toHaveBeenCalled();
    });
  });

  describe("exit", () => {
    it("calls onExit when down arrow pressed on last entry", async () => {
      const onExit = vi.fn();
      const { stdin } = renderHistory({ onExit });
      await stdin.write(keys.down);
      expect(onExit).toHaveBeenCalledOnce();
    });

    it("calls onExit when escape is pressed", async () => {
      const onExit = vi.fn();
      const { stdin } = renderHistory({ onExit });
      await stdin.write(keys.escape);
      expect(onExit).toHaveBeenCalledOnce();
    });
  });

  describe("selection", () => {
    it("calls onSelected with current entry on enter", async () => {
      const onSelected = vi.fn();
      const { stdin } = renderHistory({ onSelected });
      await stdin.write(keys.enter);
      expect(onSelected).toHaveBeenCalledWith("third");
    });

    it("calls onSelected with navigated entry on enter", async () => {
      const onSelected = vi.fn();
      const { stdin } = renderHistory({ onSelected });
      await stdin.write(keys.up);
      await stdin.write(keys.enter);
      expect(onSelected).toHaveBeenCalledWith("second");
    });
  });

  describe("instruction bar", () => {
    it("shows escape and enter instructions", () => {
      const { lastFrame } = renderHistory();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("esc");
      expect(frame).toContain("return to draft");
      expect(frame).toContain("enter");
      expect(frame).toContain("replace draft");
    });

    it("shows up next when there are older entries", async () => {
      const { stdin, lastFrame } = renderHistory();
      // Default is last entry, so up is available.
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("up");
      expect(frame).toContain("next");
    });

    it("does not show up next on the first entry", async () => {
      const { stdin, lastFrame } = renderHistory();
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Now at first entry.
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("up");
      expect(frame).not.toContain("next");
    });

    it("shows down previous when there are newer entries", async () => {
      const { stdin, lastFrame } = renderHistory();
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("down");
      expect(frame).toContain("previous");
    });

    it("shows esc/down return to draft on the last entry", () => {
      const { lastFrame } = renderHistory();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("esc/down");
      expect(frame).toContain("return to draft");
      expect(frame).not.toContain("previous");
    });

    it("shows esc without down when not on the last entry", async () => {
      const { stdin, lastFrame } = renderHistory();
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("esc/down");
      expect(frame).toContain("esc");
      expect(frame).toContain("return to draft");
    });

    it("shows only single entry with no up and esc/down to exit", () => {
      const { lastFrame } = renderHistory({ entries: ["only"] });
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("up");
      expect(frame).toContain("esc/down");
    });
  });
});
