import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { type LineMode, useTextInput } from "./text";

/** Test harness that renders useTextInput and exposes cursor position. */
function Harness(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  lineMode: LineMode;
  onUp?: () => void;
  onDown?: () => void;
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
    onCursor: (cursor: number) => void;
    onSetCursor: (setCursor: (pos: number) => void) => void;
  }> = {},
) {
  return render(
    createElement(Harness, {
      value: overrides.value ?? "",
      onChange: overrides.onChange ?? (() => {}),
      onSubmit: overrides.onSubmit ?? (() => {}),
      lineMode: overrides.lineMode ?? "multi",
      onUp: overrides.onUp,
      onDown: overrides.onDown,
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
      stdin.write("\x08");
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("removes character on backspace (macOS delete)", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x7f");
      expect(onChange).toHaveBeenCalledWith("hell");
    });

    it("does not call onChange on backspace when empty", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "", onChange });
      stdin.write("\x08");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("calls onSubmit on enter", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onSubmit });
      stdin.write("\r");
      expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("inserts newline on shift+enter", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[13;2u");
      expect(onChange).toHaveBeenCalledWith("hello\n");
    });

    it("inserts newline at cursor position on shift+enter", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[13;2u");
      expect(onChange).toHaveBeenCalledWith("hel\nlo");
    });

    it("does not call onSubmit on shift+enter in multi mode", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onSubmit });
      stdin.write("\x1b[13;2u");
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it("shift+enter submits in single mode", () => {
      const onSubmit = vi.fn();
      const { stdin } = renderHarness({
        value: "hello",
        onSubmit,
        lineMode: "single",
      });
      stdin.write("\x1b[13;2u");
      expect(onSubmit).toHaveBeenCalledWith("hello");
    });

    it("shift+enter does not insert newline in single mode", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({
        value: "hello",
        onChange,
        lineMode: "single",
      });
      stdin.write("\x1b[13;2u");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores ctrl key combinations", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x01");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores escape key", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("ignores tab key", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\t");
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("cursor", () => {
    it("inserts at cursor position after moving left", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "helo", onChange });
      stdin.write("\x1b[D");
      stdin.write("l");
      expect(onChange).toHaveBeenCalledWith("hello");
    });

    it("deletes before cursor position after moving left", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[D");
      stdin.write("\x08");
      expect(onChange).toHaveBeenCalledWith("helo");
    });

    it("does not backspace past the beginning", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "a", onChange });
      stdin.write("\x1b[D");
      stdin.write("\x08");
      expect(onChange).not.toHaveBeenCalled();
    });

    it("moves cursor left and right", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "abc", onChange });
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("abxc");
    });

    it("does not move cursor left past beginning", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "ab", onChange });
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("\x1b[D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xab");
    });

    it("does not move cursor right past end", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "ab", onChange });
      stdin.write("\x1b[C");
      stdin.write("\x1b[C");
      stdin.write("\x1b[C");
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
      stdin.write("\x1b[D");
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

    it("up arrow moves cursor to start", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[A");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello");
    });

    it("down arrow moves cursor to end", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[A");
      stdin.write("\x1b[B");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("option+left jumps to start of previous word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello xworld");
    });

    it("option+left jumps across multiple words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "one two three", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("one xtwo three");
    });

    it("option+left from start stays at 0", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello");
    });

    it("option+right jumps to end of next word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox world");
    });

    it("option+right from end stays at end", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onChange });
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox");
    });

    it("option+left skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello  world", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhello  world");
    });

    it("option+right skips multiple spaces between words", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello  world", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3C");
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello  worldx");
    });

    it("option+left stops at newline boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello\nworld", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello\nxworld");
    });

    it("option+right stops at newline boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello\nworld", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox\nworld");
    });

    it("option+left stops at punctuation boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello-world", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello-xworld");
    });

    it("option+right stops at punctuation boundary", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello-world", onChange });
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3C");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox-world");
    });

    it("option+left skips consecutive punctuation", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "https://example", onChange });
      // From end: "example"(8) → skip "://"(5) → "https"(0)
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("\x1b[1;3D");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("xhttps://example");
    });

    it("option+left via readline sequence jumps to start of previous word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write("\x1bb");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hello xworld");
    });

    it("option+right via readline sequence jumps to end of next word", () => {
      const onChange = vi.fn();
      const { stdin } = renderHarness({ value: "hello world", onChange });
      stdin.write("\x1bb");
      stdin.write("\x1bb");
      stdin.write("\x1bf");
      stdin.write("x");
      expect(onChange).toHaveBeenCalledWith("hellox world");
    });

    it("fires onUp when up arrow pressed at start", () => {
      const onUp = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onUp });
      // Move to start first, then press up again
      stdin.write("\x1b[A");
      stdin.write("\x1b[A");
      expect(onUp).toHaveBeenCalledOnce();
    });

    it("does not fire onUp when cursor is not at start", () => {
      const onUp = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onUp });
      // Cursor at end, up moves to start — should not fire onUp
      stdin.write("\x1b[A");
      expect(onUp).not.toHaveBeenCalled();
    });

    it("fires onDown when down arrow pressed at end", () => {
      const onDown = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onDown });
      // Already at end, press down
      stdin.write("\x1b[B");
      expect(onDown).toHaveBeenCalledOnce();
    });

    it("does not fire onDown when cursor is not at end", () => {
      const onDown = vi.fn();
      const { stdin } = renderHarness({ value: "hello", onDown });
      // Move to start, then down moves to end — should not fire onDown
      stdin.write("\x1b[A");
      stdin.write("\x1b[B");
      expect(onDown).not.toHaveBeenCalled();
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
