import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushInkFrames } from "../test-utils/flush-ink";
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

    return render(
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

      const { lastFrame } = render(
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
      stdin.write("\x1b[A");
      await flushInkFrames();
      expect(lastFrame()).toContain("second");
    });

    it("navigates to next entry on down arrow", async () => {
      const { stdin, lastFrame } = renderHistory();
      stdin.write("\x1b[A");
      await flushInkFrames();
      stdin.write("\x1b[B");
      await flushInkFrames();
      expect(lastFrame()).toContain("third");
    });

    it("does not navigate past the first entry", async () => {
      const { stdin, lastFrame } = renderHistory();
      stdin.write("\x1b[A");
      stdin.write("\x1b[A");
      stdin.write("\x1b[A");
      stdin.write("\x1b[A");
      await flushInkFrames();
      expect(lastFrame()).toContain("first");
    });

    it("ignores unhandled keys", async () => {
      const onExit = vi.fn();
      const onSelected = vi.fn();
      const { stdin, lastFrame } = renderHistory({ onExit, onSelected });
      stdin.write("x");
      await flushInkFrames();
      expect(lastFrame()).toContain("third");
      expect(onExit).not.toHaveBeenCalled();
      expect(onSelected).not.toHaveBeenCalled();
    });

    it("navigates down through middle entries without exiting", async () => {
      const onExit = vi.fn();
      const { stdin, lastFrame } = renderHistory({ onExit });
      // Navigate to first entry, then back down to second.
      stdin.write("\x1b[A");
      stdin.write("\x1b[A");
      await flushInkFrames();
      stdin.write("\x1b[B");
      await flushInkFrames();
      expect(lastFrame()).toContain("second");
      expect(onExit).not.toHaveBeenCalled();
    });
  });

  describe("exit", () => {
    it("calls onExit when down arrow pressed on last entry", () => {
      const onExit = vi.fn();
      const { stdin } = renderHistory({ onExit });
      stdin.write("\x1b[B");
      expect(onExit).toHaveBeenCalledOnce();
    });

    it("calls onExit when escape is pressed", async () => {
      const onExit = vi.fn();
      const { stdin } = renderHistory({ onExit });
      stdin.write("\x1b");
      await flushInkFrames();
      expect(onExit).toHaveBeenCalledOnce();
    });
  });

  describe("selection", () => {
    it("calls onSelected with current entry on enter", () => {
      const onSelected = vi.fn();
      const { stdin } = renderHistory({ onSelected });
      stdin.write("\r");
      expect(onSelected).toHaveBeenCalledWith("third");
    });

    it("calls onSelected with navigated entry on enter", async () => {
      const onSelected = vi.fn();
      const { stdin } = renderHistory({ onSelected });
      stdin.write("\x1b[A");
      await flushInkFrames();
      stdin.write("\r");
      expect(onSelected).toHaveBeenCalledWith("second");
    });
  });
});
