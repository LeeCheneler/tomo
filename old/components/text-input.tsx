import chalk from "chalk";
import { Text, useInput } from "ink";
import { useRef, useState } from "react";

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  masked?: boolean;
  /** When false, renders read-only without capturing input. Defaults to true. */
  active?: boolean;
}

function findPrevWordBoundary(text: string, pos: number): number {
  let i = pos - 1;
  while (i > 0 && /\s/.test(text[i])) i--;
  while (i > 0 && !/\s/.test(text[i - 1])) i--;
  return Math.max(0, i);
}

function findNextWordBoundary(text: string, pos: number): number {
  let i = pos;
  while (i < text.length && /\s/.test(text[i])) i++;
  while (i < text.length && !/\s/.test(text[i])) i++;
  return i;
}

/**
 * Single-line text input with cursor navigation and word-level editing.
 *
 * Handles: left/right arrows, word-skip (Alt+arrows, Alt+b/f), Ctrl+A/E,
 * backspace, word-delete (Ctrl+W, Alt+Backspace, Ctrl+Backspace), character input.
 *
 * Does NOT handle: Enter, Esc, up/down arrows — the parent handles these.
 */
export function TextInput({
  value,
  onChange,
  masked,
  active = true,
}: TextInputProps) {
  const [cursor, setCursor] = useState(value.length);
  const prevValueRef = useRef(value);
  const selfChangeRef = useRef(false);

  // Reset cursor only when value changes externally (e.g. parent resets to "").
  // Skip reset when the change originated from our own onChange call.
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    if (!selfChangeRef.current) {
      setCursor(value.length);
    }
    selfChangeRef.current = false;
  }

  useInput(
    (input, key) => {
      // Word-skip: Alt+Arrow or Alt+B/F
      if (key.leftArrow && key.meta) {
        setCursor((c) => findPrevWordBoundary(value, c));
        return;
      }
      if (key.rightArrow && key.meta) {
        setCursor((c) => findNextWordBoundary(value, c));
        return;
      }
      if (input === "b" && key.meta) {
        setCursor((c) => findPrevWordBoundary(value, c));
        return;
      }
      if (input === "f" && key.meta) {
        setCursor((c) => findNextWordBoundary(value, c));
        return;
      }

      // Cursor navigation
      if (key.leftArrow) {
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      if (key.rightArrow) {
        setCursor((c) => Math.min(value.length, c + 1));
        return;
      }
      if (input === "a" && key.ctrl) {
        setCursor(0);
        return;
      }
      if (input === "e" && key.ctrl) {
        setCursor(value.length);
        return;
      }

      // Delete previous word: Ctrl+Backspace, Alt+Backspace, Ctrl+W
      if (
        key.backspace ||
        (key.delete && (key.ctrl || key.meta)) ||
        (input === "w" && key.ctrl)
      ) {
        if (cursor > 0) {
          const boundary = findPrevWordBoundary(value, cursor);
          selfChangeRef.current = true;
          onChange(value.slice(0, boundary) + value.slice(cursor));
          setCursor(boundary);
        }
        return;
      }

      // Single character delete
      if (key.delete) {
        if (cursor > 0) {
          selfChangeRef.current = true;
          onChange(value.slice(0, cursor - 1) + value.slice(cursor));
          setCursor((c) => c - 1);
        }
        return;
      }

      // Character input
      if (input && !key.ctrl && !key.meta) {
        const newValue = value.slice(0, cursor) + input + value.slice(cursor);
        selfChangeRef.current = true;
        onChange(newValue);
        setCursor((c) => c + input.length);
      }
    },
    { isActive: active },
  );

  const display = masked ? "*".repeat(value.length) : value;

  if (!active) {
    return <Text>{display || chalk.dim("(empty)")}</Text>;
  }

  const before = display.slice(0, cursor);
  const charAtCursor = cursor < display.length ? display[cursor] : null;
  const after = cursor < display.length ? display.slice(cursor + 1) : "";
  const cursorStr =
    charAtCursor !== null ? chalk.inverse(charAtCursor) : chalk.dim("█");

  return (
    <Text>
      {before}
      {cursorStr}
      {after}
    </Text>
  );
}
