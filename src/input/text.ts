import { useInput } from "ink";
import { useRef, useState } from "react";

/** Controls newline behaviour. "multi" allows Shift+Enter newlines, "single" does not. */
export type LineMode = "single" | "multi";

/** Options for the useTextInput hook. */
export interface TextInputOptions {
  /** Current text value. */
  value: string;
  /** Called when the value changes. */
  onChange: (value: string) => void;
  /** Called when the user submits (Enter). */
  onSubmit: (value: string) => void;
  /** Controls newline behaviour. "multi" allows Shift+Enter newlines, "single" does not. */
  lineMode: LineMode;
  /** Called when up arrow is pressed and cursor is already at the start. */
  onUp?: () => void;
  /** Called when down arrow is pressed and cursor is already at the end. */
  onDown?: () => void;
}

/** Return value of useTextInput. */
export interface TextInputResult {
  /** Current cursor position for rendering. */
  cursor: number;
  /** Sets the cursor position directly. Useful for resetting after programmatic value changes. */
  setCursor: (pos: number) => void;
}

const WORD_CHAR = /\w/;

/** Returns true if the character is a word character (alphanumeric or underscore). */
function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** Finds the start of the previous word from the given position. */
function findPreviousWordBoundary(value: string, pos: number): number {
  if (pos <= 0) {
    return 0;
  }
  let i = pos - 1;
  // Skip non-word characters (whitespace, punctuation).
  while (i > 0 && !isWordChar(value[i - 1])) {
    i--;
  }
  // Skip the word itself.
  while (i > 0 && isWordChar(value[i - 1])) {
    i--;
  }
  return i;
}

/** Finds the end of the next word from the given position. */
function findNextWordBoundary(value: string, pos: number): number {
  let i = pos;
  // Skip non-word characters (whitespace, punctuation).
  while (i < value.length && !isWordChar(value[i])) {
    i++;
  }
  // Skip the word itself to land at end of word.
  while (i < value.length && isWordChar(value[i])) {
    i++;
  }
  return i;
}

/** Tracks cursor position within the input value using a ref for immediate access in callbacks. */
function useCursor(valueLength: number) {
  const ref = useRef(valueLength);
  const [, rerender] = useState(0);

  // Clamp cursor to valid range on each render.
  ref.current = Math.max(0, Math.min(ref.current, valueLength));

  /** Updates cursor position and triggers a re-render. */
  function setCursor(pos: number) {
    ref.current = pos;
    rerender((n) => n + 1);
  }

  /** Returns the current cursor position (always fresh, safe in callbacks). */
  function getCursor() {
    return ref.current;
  }

  return { cursor: ref.current, getCursor, setCursor };
}

/** Manages text input state: cursor position, keyboard handling, and value changes. */
export function useTextInput(options: TextInputOptions): TextInputResult {
  // Value ref stays fresh across batched React updates. Updated on render
  // from options.value and immediately when onChange fires, so the next
  // event in the same tick always sees the latest value.
  const valueRef = useRef(options.value);
  valueRef.current = options.value;

  const { cursor, getCursor, setCursor } = useCursor(valueRef.current.length);
  const lineMode = options.lineMode;

  /** Updates value ref and notifies the parent. */
  function applyChange(newValue: string) {
    valueRef.current = newValue;
    options.onChange(newValue);
  }

  useInput((input, key) => {
    const pos = getCursor();
    const value = valueRef.current;

    // In multi mode, Shift+Enter inserts a newline and plain Enter submits.
    // In single mode, both submit.
    // Not all macOS terminals distinguish Shift+Enter from Enter — iTerm2 and
    // Kitty do, but Terminal.app sends the same \r for both.
    if (key.return) {
      if (key.shift && lineMode === "multi") {
        const before = value.slice(0, pos);
        const after = value.slice(pos);
        applyChange(`${before}\n${after}`);
        setCursor(pos + 1);
      } else {
        options.onSubmit(value);
      }
      return;
    }

    // macOS Backspace sends \x7f which Ink maps to key.delete.
    if (key.backspace || key.delete) {
      if (pos > 0) {
        const before = value.slice(0, pos - 1);
        const after = value.slice(pos);
        applyChange(before + after);
        setCursor(pos - 1);
      }
      return;
    }

    // Ignore control sequences that aren't printable characters.
    if (key.ctrl || key.escape) {
      return;
    }

    // Word jump: Option+Left/Right sends CSI meta+arrow (\x1b[1;3D / \x1b[1;3C)
    // in most terminals. Some terminals (and readline) send ESC+b / ESC+f instead.
    // We handle both so word-jump works regardless of terminal configuration.
    if (key.meta && (input === "b" || key.leftArrow)) {
      setCursor(findPreviousWordBoundary(value, pos));
      return;
    }

    if (key.meta && (input === "f" || key.rightArrow)) {
      setCursor(findNextWordBoundary(value, pos));
      return;
    }

    if (key.leftArrow) {
      setCursor(pos - 1);
      return;
    }

    if (key.rightArrow) {
      setCursor(pos + 1);
      return;
    }

    if (key.upArrow) {
      if (pos === 0) {
        options.onUp?.();
      } else {
        setCursor(0);
      }
      return;
    }

    if (key.downArrow) {
      if (pos === value.length) {
        options.onDown?.();
      } else {
        setCursor(value.length);
      }
      return;
    }

    // Ignore remaining meta combinations or special keys.
    if (key.meta || key.tab) {
      return;
    }

    const before = value.slice(0, pos);
    const after = value.slice(pos);
    applyChange(before + input + after);
    setCursor(pos + input.length);
  });

  return { cursor, setCursor };
}
