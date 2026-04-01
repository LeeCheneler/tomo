import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { flushInkFrames } from "../test-utils/flush-ink";
import { ChatInput, splitAtCursor } from "./chat-input";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("ChatInput", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders ChatInput with sensible defaults and a fixed terminal width. */
  function renderInput(
    overrides: Partial<{
      onMessage: (message: string) => void;
      onUp: () => void;
      initialValue: string;
    }> = {},
  ) {
    setColumns(COLUMNS);

    return render(
      <ChatInput
        onMessage={overrides.onMessage ?? (() => {})}
        onUp={overrides.onUp}
        initialValue={overrides.initialValue}
      />,
    );
  }

  describe("layout", () => {
    it("renders a top border at full terminal width", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      // paddingTop={1} adds an empty line before the border.
      expect(lines[1]).toBe("─".repeat(COLUMNS));
    });

    it("renders the prompt marker", () => {
      const { lastFrame } = renderInput();
      expect(lastFrame()).toContain("❯");
    });

    it("falls back to 80 columns when stdout.columns is undefined", () => {
      setColumns(undefined);

      const { lastFrame } = render(<ChatInput onMessage={() => {}} />);

      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      expect(lines[1]).toBe("─".repeat(80));
    });
  });

  describe("submit", () => {
    it("calls onMessage with value on enter", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("hello");
      stdin.write("\r");
      expect(onMessage).toHaveBeenCalledWith("hello");
    });

    it("does not call onMessage when value is empty", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("\r");
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("does not call onMessage when value is only whitespace", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("   ");
      stdin.write("\r");
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("clears input after submit so next submit requires new input", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("hello");
      stdin.write("\r");
      stdin.write("\r");
      expect(onMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("onUp", () => {
    it("calls onUp when up arrow is pressed with cursor at start", () => {
      const onUp = vi.fn();
      const { stdin } = renderInput({ onUp });
      stdin.write("\x1B[A");
      expect(onUp).toHaveBeenCalledOnce();
    });

    it("does not call onUp when cursor is not at start", () => {
      const onUp = vi.fn();
      const { stdin } = renderInput({ onUp });
      stdin.write("hello");
      stdin.write("\x1B[A");
      expect(onUp).not.toHaveBeenCalled();
    });
  });

  describe("initialValue", () => {
    it("renders with initialValue text", () => {
      const { lastFrame } = renderInput({ initialValue: "hello world" });
      expect(lastFrame()).toContain("hello world");
    });

    it("defaults to empty when no initialValue provided", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      // Only the prompt marker and cursor placeholder should be between borders.
      expect(frame).not.toContain("hello");
    });
  });

  describe("escape to clear", () => {
    it("shows hint after first escape when input has content", async () => {
      const { stdin, lastFrame } = renderInput();
      stdin.write("hello");
      stdin.write("\x1b");
      await flushInkFrames();
      expect(lastFrame()).toContain("Escape again to clear");
    });

    it("clears input and hides hint on second escape", async () => {
      const { stdin, lastFrame } = renderInput();
      stdin.write("hello");
      stdin.write("\x1b");
      await flushInkFrames();
      stdin.write("\x1b");
      await flushInkFrames();
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("hello");
      expect(frame).not.toContain("Escape again to clear");
    });

    it("hides hint when user types after first escape", async () => {
      const { stdin, lastFrame } = renderInput();
      stdin.write("hello");
      stdin.write("\x1b");
      await flushInkFrames();
      stdin.write("x");
      await flushInkFrames();
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("Escape again to clear");
      expect(frame).toContain("hellox");
    });

    it("does not show hint when input is empty", async () => {
      const { stdin, lastFrame } = renderInput();
      stdin.write("\x1b");
      await flushInkFrames();
      expect(lastFrame()).not.toContain("Escape again to clear");
    });

    it("renders hint right-aligned below bottom border", async () => {
      const { stdin, lastFrame } = renderInput();
      stdin.write("hello");
      stdin.write("\x1b");
      await flushInkFrames();
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const hintLine = lines[lines.length - 1];
      // Hint should be right-aligned: padded spaces + hint text = terminal width.
      expect(hintLine).toHaveLength(COLUMNS);
      expect(hintLine.trimStart()).toBe("Escape again to clear");
    });
  });
});

describe("splitAtCursor", () => {
  it("splits at a normal character", () => {
    const result = splitAtCursor("hello", 2);
    expect(result).toEqual({ before: "he", at: "l", after: "lo" });
  });

  it("shows space placeholder at end of value", () => {
    const result = splitAtCursor("hello", 5);
    expect(result).toEqual({ before: "hello", at: " ", after: "" });
  });

  it("shows space placeholder on newline and preserves it in after", () => {
    const result = splitAtCursor("abc\ndef", 3);
    expect(result).toEqual({ before: "abc", at: " ", after: "\ndef" });
  });

  it("handles cursor at start", () => {
    const result = splitAtCursor("hello", 0);
    expect(result).toEqual({ before: "", at: "h", after: "ello" });
  });

  it("handles empty value", () => {
    const result = splitAtCursor("", 0);
    expect(result).toEqual({ before: "", at: " ", after: "" });
  });
});
