import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { type LineMode, useTextInput } from "./text";

/** Test harness that renders useTextInput and exposes cursor position. */
function Harness(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  lineMode: LineMode;
  onUp?: () => void;
  onDown?: () => void;
  onEscape?: () => void;
  captureUpDown?: boolean;
  onCursor?: (cursor: number) => void;
  onSetCursor?: (setCursor: (pos: number) => void) => void;
}) {
  const { cursor, setCursor } = useTextInput({
    value: props.value,
    onChange: props.onChange,
    onSubmit: props.onSubmit,
    lineMode: props.lineMode,
    onUp: props.onUp,
    onDown: props.onDown,
    onEscape: props.onEscape,
    captureUpDown: props.captureUpDown,
  });
  props.onCursor?.(cursor);
  props.onSetCursor?.(setCursor);
  return null;
}

/** Renders the harness with sensible defaults. */
function renderHarness(
  overrides: Partial<{
    value: string;
    onChange: (v: string) => void;
    onSubmit: (v: string) => void;
    lineMode: LineMode;
    onUp: () => void;
    onDown: () => void;
    onEscape: () => void;
    captureUpDown: boolean;
    onCursor: (cursor: number) => void;
    onSetCursor: (setCursor: (pos: number) => void) => void;
  }> = {},
) {
  return renderInk(
    createElement(Harness, {
      value: overrides.value ?? "",
      onChange: overrides.onChange ?? (() => {}),
      onSubmit: overrides.onSubmit ?? (() => {}),
      lineMode: overrides.lineMode ?? "multi",
      onUp: overrides.onUp,
      onDown: overrides.onDown,
      onEscape: overrides.onEscape,
      captureUpDown: overrides.captureUpDown,
      onCursor: overrides.onCursor,
      onSetCursor: overrides.onSetCursor,
    }),
  );
}

describe("useTextInput", () => {
  describe("typing", () => {
    it("appends character at end", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hel", onChange });
      stdin.write("l");
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("removes character on backspace (ctrl+h)", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.backspace);
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("removes character on backspace (macOS delete)", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.delete);
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("does not call onChange on backspace when empty", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "", onChange });
      stdin.write(keys.backspace);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("calls onSubmit on enter", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onSubmit });
      stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("inserts newline on shift+enter", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.shiftEnter);
      expect(onChange).toHaveBeenCalledWith("hello\n");
    });

    it("inserts newline at cursor position on shift+enter", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.shiftEnter);
      expect(onChange).toHaveBeenCalledWith("hel\nlo");
    });

    it("does not call onSubmit on shift+enter in multi mode", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onSubmit });
      stdin.write(keys.shiftEnter);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shift+enter submits in single mode", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderHarness({
        value: "hello",
        onSubmit,
        lineMode: "single",
      });
      stdin.write(keys.shiftEnter);
      expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("shift+enter does not insert newline in single mode", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({
        value: "hello",
        onChange,
        lineMode: "single",
      });
      stdin.write(keys.shiftEnter);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores ctrl key combinations", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.ctrlA);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores escape key", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.escape);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("calls onEscape when escape key is pressed", async () => {
      const onEscape = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onEscape });
      await stdin.write(keys.escape);
      expect(onEscape).toHaveBeenCalledOnce();
    });

    it("ignores tab key", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.tab);
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("cursor", () => {
    it("inserts at cursor position after moving left", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "helo", onChange });
      stdin.write(keys.left);
      stdin.write("l");
      expect(onChange).toHaveBeenCalledWith("hello");
    });

    it("deletes before cursor position after moving left", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.left);
      stdin.write(keys.backspace);
      expect(onChange).toHaveBeenCalledWith("helo");
    });

    it("does not backspace past the beginning", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "a", onChange });
      stdin.write(keys.left);
      stdin.write(keys.backspace);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("moves cursor left and right", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "abc", onChange });
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.right);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abxc");
    });

    it("does not move cursor left past beginning", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "ab", onChange });
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xab");
    });

    it("does not move cursor right past end", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "ab", onChange });
      stdin.write(keys.right);
      stdin.write(keys.right);
      stdin.write(keys.right);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abx");
    });

    it("clamps cursor when value shrinks externally", () => {
      const onChange = vi.fn();
      const { stdin, rerender } = renderHarness({ value: "hello", onChange });
      rerender(
        createElement(Harness, {
          value: "he",
          onChange,
          onSubmit: () => {},
          lineMode: "multi",
        }),
      );
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hex");
    });

    it("advances cursor to end of pasted text", () => {
      const onChange = vi.fn();
      const { stdin, rerender } = renderHarness({ value: "ac", onChange });
      stdin.write(keys.left);
      stdin.write("xyz");
      expect(onChange).toHaveBeenCalledWith("axyzc");
      onChange.mockClear();
      rerender(
        createElement(Harness, {
          value: "axyzc",
          onChange,
          onSubmit: () => {},
          lineMode: "multi",
        }),
      );
      stdin.write("!");
      expect(onChange).toHaveBeenCalledWith("axyz!c");
    });

    it("up arrow on first line moves cursor to start of line", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      // Cursor at end (5), up moves to start (0)
      stdin.write(keys.up);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello");
    });

    it("down arrow on last line moves cursor to end of line", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      // Move to start, down moves to end
      stdin.write(keys.up);
      stdin.write(keys.down);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("up arrow moves to same column on previous line", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "abc\ndef", onChange });
      // Cursor at end (7), which is column 3 on line 2.
      // Up should go to column 3 on line 1 (position 3).
      stdin.write(keys.up);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abcx\ndef");
    });

    it("up arrow clamps to end of shorter previous line", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "ab\ndefgh", onChange });
      // Cursor at end (8), column 5 on line 2. Line 1 is "ab" (length 2).
      // Up clamps to column 2 (position 2).
      stdin.write(keys.up);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abx\ndefgh");
    });

    it("down arrow moves to same column on next line", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "abc\ndef", onChange });
      // Move to position 2 (column 2 on line 1).
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      // Cursor at 2. Down should go to column 2 on line 2 (position 6).
      stdin.write(keys.down);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abc\ndexf");
    });

    it("down arrow clamps to end of shorter next line", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "abcde\nfg", onChange });
      // Cursor at end of line 1 (5), column 5. Move to position 3 (column 3).
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.left);
      // Cursor at 0, move right to 3
      stdin.write(keys.right);
      stdin.write(keys.right);
      stdin.write(keys.right);
      // Cursor at 3, column 3 on line 1. Line 2 is "fg" (length 2).
      // Down clamps to column 2 (position 8).
      stdin.write(keys.down);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abcde\nfgx");
    });

    it("option+left jumps to start of previous word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello xworld");
    });

    it("option+left jumps across multiple words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "one two three", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("one xtwo three");
    });

    it("option+left from start stays at 0", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello");
    });

    it("option+right jumps to end of next word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionRight);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox world");
    });

    it("option+right from end stays at end", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write(keys.optionRight);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("option+left skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello  world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello  world");
    });

    it("option+right skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello  world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionRight);
      stdin.write(keys.optionRight);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello  worldx");
    });

    it("option+left stops at newline boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello\nworld", onChange });
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello\nxworld");
    });

    it("option+right stops at newline boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello\nworld", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionRight);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox\nworld");
    });

    it("option+left stops at punctuation boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello-world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello-xworld");
    });

    it("option+right stops at punctuation boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello-world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionRight);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox-world");
    });

    it("option+left skips consecutive punctuation", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "https://example", onChange });
      // From end: "example"(8) → skip "://"(5) → "https"(0)
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhttps://example");
    });

    it("option+backspace deletes backward to start of previous word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.optionBackspace);
      expect(onChange).toHaveBeenCalledWith("hello ");
    });

    it("option+backspace deletes across multiple words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "one two three", onChange });
      stdin.write(keys.optionBackspace);
      stdin.write(keys.optionBackspace);
      expect(onChange).toHaveBeenCalledWith("one ");
    });

    it("option+backspace from start does nothing", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      // Move cursor to start
      stdin.write(keys.optionLeft);
      onChange.mockClear();
      stdin.write(keys.optionBackspace);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("option+backspace skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello  world", onChange });
      stdin.write(keys.optionBackspace);
      expect(onChange).toHaveBeenCalledWith("hello  ");
    });

    it("option+backspace stops at punctuation boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello-world", onChange });
      stdin.write(keys.optionBackspace);
      expect(onChange).toHaveBeenCalledWith("hello-");
    });

    it("option+backspace deletes from mid-word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.left);
      stdin.write(keys.left);
      stdin.write(keys.optionBackspace);
      expect(onChange).toHaveBeenCalledWith("hello ld");
    });

    it("readline meta+d deletes forward to end of next word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.readlineWordDelete);
      expect(onChange).toHaveBeenCalledWith(" world");
    });

    it("readline meta+d deletes across multiple words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "one two three", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.readlineWordDelete);
      stdin.write(keys.readlineWordDelete);
      expect(onChange).toHaveBeenCalledWith(" three");
    });

    it("readline meta+d from end does nothing", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      onChange.mockClear();
      stdin.write(keys.readlineWordDelete);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("readline meta+d skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello  world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.readlineWordDelete);
      expect(onChange).toHaveBeenCalledWith("  world");
    });

    it("readline meta+d stops at punctuation boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello-world", onChange });
      stdin.write(keys.optionLeft);
      stdin.write(keys.optionLeft);
      stdin.write(keys.readlineWordDelete);
      expect(onChange).toHaveBeenCalledWith("-world");
    });

    it("option+left via readline sequence jumps to start of previous word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.readlineWordLeft);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello xworld");
    });

    it("option+right via readline sequence jumps to end of next word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write(keys.readlineWordLeft);
      stdin.write(keys.readlineWordLeft);
      stdin.write(keys.readlineWordRight);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox world");
    });

    it("fires onUp when up arrow pressed at start of first line", () => {
      const onUp = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onUp });
      // First up moves to start, second up fires onUp
      stdin.write(keys.up);
      stdin.write(keys.up);
      expect(onUp).toHaveBeenCalledOnce();
    });

    it("does not fire onUp on multi-line value when not on first line", () => {
      const onUp = vi.fn();
      const { stdin } = renderHarness({ value: "abc\ndef", onUp });
      // Cursor at end (line 2). Up goes to line 1, not onUp.
      stdin.write(keys.up);
      expect(onUp).not.toHaveBeenCalled();
    });

    it("fires onDown when down arrow pressed at end of last line", () => {
      const onDown = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onDown });
      // Move to start, then down moves to end, second down fires onDown.
      stdin.write(keys.up);
      stdin.write(keys.up);
      stdin.write(keys.down);
      stdin.write(keys.down);
      expect(onDown).toHaveBeenCalledOnce();
    });

    it("does not fire onDown on multi-line value when not on last line", () => {
      const onDown = vi.fn();
      const { stdin } = renderHarness({ value: "abc\ndef", onDown });
      // Move to start (line 1). Down goes to line 2, not onDown.
      stdin.write(keys.up);
      stdin.write(keys.down);
      expect(onDown).not.toHaveBeenCalled();
    });

    it("fires onUp on every up press when captureUpDown is true", () => {
      const onUp = vi.fn();
      const { stdin } = renderHarness({
        value: "hello",
        onUp,
        captureUpDown: true,
      });
      // Cursor is at end — normally up would move to start, not fire onUp.
      stdin.write(keys.up);
      expect(onUp).toHaveBeenCalledOnce();
    });

    it("fires onDown on every down press when captureUpDown is true", () => {
      const onDown = vi.fn();
      const { stdin } = renderHarness({
        value: "abc\ndef",
        onDown,
        captureUpDown: true,
      });
      // Cursor at end of line 2 — normally down at end fires onDown,
      // but with cursor at start it would move to line 2. captureUpDown skips that.
      stdin.write(keys.up);
      stdin.write(keys.up);
      // Now at start of line 1. Without captureUpDown, down would move to line 2.
      stdin.write(keys.down);
      expect(onDown).toHaveBeenCalledOnce();
    });

    it("does not move cursor on up/down when captureUpDown is true", () => {
      const onUp = vi.fn();
      const onChange = vi.fn();
      const { stdin } = renderHarness({
        value: "hello",
        onChange,
        onUp,
        captureUpDown: true,
      });
      // Up should fire onUp, not move cursor. Typing should insert at end.
      stdin.write(keys.up);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("setCursor moves cursor to specified position", () => {
      const onChange = vi.fn();
      let setCursorFn: ((pos: number) => void) | undefined;
      const { stdin } = renderHarness({
        value: "hello",
        onChange,
        onSetCursor: (sc) => {
          setCursorFn = sc;
        },
      });
      setCursorFn?.(2);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hexllo");
    });

    it("setCursor clamps to valid range", () => {
      const onChange = vi.fn();
      let setCursorFn: ((pos: number) => void) | undefined;
      const { stdin } = renderHarness({
        value: "hello",
        onChange,
        onSetCursor: (sc) => {
          setCursorFn = sc;
        },
      });
      setCursorFn?.(100);
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });
  });
});
