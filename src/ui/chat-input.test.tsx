import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

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
    // Restore to undefined so tests don't leak.
    setColumns(undefined);
  });

  /** Renders ChatInput with sensible defaults and a fixed terminal width. */
  function renderInput(
    overrides: Partial<{
      value: string;
      onChange: (value: string) => void;
      onSubmit: (value: string) => void;
      statusText: string;
    }> = {},
  ) {
    setColumns(COLUMNS);

    return render(
      <ChatInput
        value={overrides.value ?? ""}
        onChange={overrides.onChange ?? (() => {})}
        onSubmit={overrides.onSubmit ?? (() => {})}
        statusText={overrides.statusText ?? ""}
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

    it("renders the input value with a prompt marker", () => {
      const { lastFrame } = renderInput({ value: "hello world" });
      expect(lastFrame()).toContain("❯ hello world");
    });

    it("renders the prompt marker when value is empty", () => {
      const { lastFrame } = renderInput({ value: "" });
      // Ink trims trailing whitespace, so we assert on the marker alone.
      expect(lastFrame()).toContain("❯");
    });

    it("falls back to 80 columns when stdout.columns is undefined", () => {
      setColumns(undefined);

      const { lastFrame } = render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          statusText=""
        />,
      );

      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      expect(lines[1]).toBe("─".repeat(80));
    });
  });

  describe("status bar", () => {
    it("renders a bottom border at full terminal width with no status", () => {
      const { lastFrame } = renderInput({ statusText: "" });
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const bottomBorder = lines[lines.length - 1];
      expect(bottomBorder).toBe("─".repeat(COLUMNS));
    });

    it("renders status text right-aligned on the bottom border", () => {
      const status = "1% context";
      const { lastFrame } = renderInput({ statusText: status });
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const bottomBorder = lines[lines.length - 1];

      const trailingSuffix = "──";
      const expectedSuffix = `${status}${trailingSuffix}`;
      expect(bottomBorder).toContain(expectedSuffix);
      expect(bottomBorder).toHaveLength(COLUMNS);

      const leadingLength = COLUMNS - status.length - 2;
      const leading = "─".repeat(leadingLength);
      expect(bottomBorder).toBe(`${leading}${status}${trailingSuffix}`);
    });
  });

  describe("typing", () => {
    it("calls onChange with appended character when a key is typed", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hel", onChange });
      stdin.write("l");
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("calls onChange with character removed on backspace (ctrl+h)", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      stdin.write("\x08");
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("calls onChange with character removed on backspace (macOS delete)", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      stdin.write("\x7f");
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("does not call onChange on backspace when value is empty", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "", onChange });
      stdin.write("\x08");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("calls onSubmit on enter", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderInput({ value: "hello", onSubmit });
      stdin.write("\r");
      expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("inserts newline on shift+enter", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      stdin.write("\x1b[13;2u");
      expect(onChange).toHaveBeenCalledWith("hello\n");
    });

    it("inserts newline at cursor position on shift+enter", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // Move cursor left twice, then shift+enter
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[13;2u");
      expect(onChange).toHaveBeenCalledWith("hel\nlo");
    });

    it("does not call onSubmit on shift+enter", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderInput({ value: "hello", onSubmit });
      stdin.write("\x1b[13;2u");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("ignores ctrl key combinations", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // ctrl+a
      stdin.write("\x01");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores escape key", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      stdin.write("\x1b");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("up arrow moves cursor to start of input", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // Cursor at end (5). Up arrow → position 0.
      stdin.write("\x1b[A");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello");
    });

    it("down arrow moves cursor to end of input", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // Move cursor to start via up, then down → back to end.
      stdin.write("\x1b[A");
      stdin.write("\x1b[B");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("ignores tab key", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      stdin.write("\t");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("cursor", () => {
    it("renders text around cursor when cursor is mid-value", () => {
      const { lastFrame, stdin } = renderInput({ value: "hello" });
      // Move cursor left twice — cursor sits on 'l' (index 3)
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      // Ink strips ANSI inverse, but the characters are still present.
      expect(lastFrame()).toContain("❯ hello");
    });

    it("inserts characters at cursor position after moving left", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "helo", onChange });
      // Move cursor left once (before 'o')
      stdin.write("\x1b[D");
      stdin.write("l");
      expect(onChange).toHaveBeenCalledWith("hello");
    });

    it("deletes character before cursor position after moving left", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // Move cursor left once (before 'o'), then backspace deletes 'l'
      stdin.write("\x1b[D");
      stdin.write("\x08");
      expect(onChange).toHaveBeenCalledWith("helo");
    });

    it("does not backspace past the beginning", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "a", onChange });
      // Move cursor to start, then try backspace
      stdin.write("\x1b[D");
      stdin.write("\x08");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("moves cursor left and right", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "abc", onChange });
      // Move left twice (cursor at 1), then right once (cursor at 2), type "x"
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abxc");
    });

    it("does not move cursor left past beginning", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "ab", onChange });
      // Move left 5 times (more than length), then type "x"
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xab");
    });

    it("clamps cursor when value shrinks externally", () => {
      const onChange = vi.fn();
      const { stdin, rerender } = renderInput({ value: "hello", onChange });
      // Move cursor to end (position 5), then shrink value to 2 chars
      rerender(
        <ChatInput
          value="he"
          onChange={onChange}
          onSubmit={() => {}}
          statusText=""
        />,
      );
      // Type at cursor — should be clamped to position 2 (end of "he")
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hex");
    });

    it("advances cursor to end of pasted text", () => {
      const onChange = vi.fn();
      const { stdin, rerender } = renderInput({ value: "ac", onChange });
      // Move cursor left (position 1), then paste "xyz"
      stdin.write("\x1b[D");
      stdin.write("xyz");
      expect(onChange).toHaveBeenCalledWith("axyzc");
      // Simulate parent updating value after paste
      onChange.mockClear();
      rerender(
        <ChatInput
          value="axyzc"
          onChange={onChange}
          onSubmit={() => {}}
          statusText=""
        />,
      );
      // Type "!" — should insert at position 4 (after "axyz", before "c")
      stdin.write("!");
      expect(onChange).toHaveBeenCalledWith("axyz!c");
    });

    it("does not move cursor right past end", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "ab", onChange });
      // Move right 5 times (already at end), then type "x"
      stdin.write("\x1b[C");
      stdin.write("\x1b[C");
      stdin.write("\x1b[C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abx");
    });

    it("option+left jumps to start of previous word", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello world", onChange });
      // Cursor starts at end (11). Option+Left jumps to start of "world" (6).
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello xworld");
    });

    it("option+left jumps across multiple words", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "one two three", onChange });
      // Option+Left twice: end(13) → start of "three"(8) → start of "two"(4)
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("one xtwo three");
    });

    it("option+left from start stays at 0", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // Move to start, then option+left again
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello");
    });

    it("option+right jumps to end of next word", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello world", onChange });
      // Move to start first, then option+right jumps to end of "hello" (5)
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox world");
    });

    it("option+right from end stays at end", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello", onChange });
      // Already at end, option+right should stay at end
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("option+left skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello  world", onChange });
      // Cursor at end (12). Option+Left skips "world" then the double space → 0
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello  world");
    });

    it("option+right skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello  world", onChange });
      // Move to start, option+right lands at 5 (end of "hello"),
      // then second option+right skips double space + "world" → 12
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3C");
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello  worldx");
    });

    it("ESC+b jumps to start of previous word (readline binding)", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello world", onChange });
      stdin.write("\x1bb");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello xworld");
    });

    it("ESC+f jumps to end of next word (readline binding)", () => {
      const onChange = vi.fn();
      const { stdin } = renderInput({ value: "hello world", onChange });
      stdin.write("\x1bb");
      stdin.write("\x1bb");
      stdin.write("\x1bf");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox world");
    });
  });
});
