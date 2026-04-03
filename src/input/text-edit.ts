import type { Key } from "ink";
import {
  findNextWordBoundary,
  findPreviousWordBoundary,
  getCursorLineInfo,
  lineColumnToPos,
} from "./cursor";

/** Controls newline behaviour. "multi" allows Shift+Enter newlines, "single" does not. */
export type LineMode = "single" | "multi";

/** Result of processing a text edit. */
export interface TextEditResult {
  value: string;
  cursor: number;
}

/** Options for processTextEdit. */
export interface TextEditOptions {
  /** Line mode. "multi" enables shift+enter newlines and up/down line navigation. Defaults to "single". */
  lineMode?: LineMode;
  /** When true in multi mode, up/down always return null instead of navigating lines. */
  captureUpDown?: boolean;
}

/**
 * Processes a text edit for the given key event.
 * Returns the updated value and cursor, or null if the key was not a text edit.
 * Handles: insert, backspace, left/right, word jump, word delete.
 * In multi mode: shift+enter inserts newline, up/down navigates lines.
 * Returns null for unhandled keys — letting the caller handle those.
 */
export function processTextEdit(
  input: string,
  key: Key,
  value: string,
  cursor: number,
  options?: TextEditOptions,
): TextEditResult | null {
  const lineMode = options?.lineMode ?? "single";

  // Multi-line: Shift+Enter inserts a newline.
  if (key.return && key.shift && lineMode === "multi") {
    return {
      value: `${value.slice(0, cursor)}\n${value.slice(cursor)}`,
      cursor: cursor + 1,
    };
  }

  // Multi-line vertical navigation with line-aware cursor positioning.
  if (key.upArrow && lineMode === "multi" && !options?.captureUpDown) {
    const { lineIndex, column, lines } = getCursorLineInfo(value, cursor);
    if (lineIndex === 0) {
      // On first line: move to start. Return null if already there so caller can handle boundary.
      if (cursor === 0) return null;
      return { value, cursor: 0 };
    }
    return { value, cursor: lineColumnToPos(lines, lineIndex - 1, column) };
  }

  if (key.downArrow && lineMode === "multi" && !options?.captureUpDown) {
    const { lineIndex, column, lines } = getCursorLineInfo(value, cursor);
    if (lineIndex === lines.length - 1) {
      // On last line: move to end. Return null if already there so caller can handle boundary.
      if (cursor === value.length) return null;
      return { value, cursor: value.length };
    }
    return { value, cursor: lineColumnToPos(lines, lineIndex + 1, column) };
  }

  // Word delete backward: Option+Backspace.
  if (key.meta && (key.backspace || key.delete)) {
    const boundary = findPreviousWordBoundary(value, cursor);
    if (boundary < cursor) {
      return {
        value: value.slice(0, boundary) + value.slice(cursor),
        cursor: boundary,
      };
    }
    return { value, cursor };
  }

  // Word delete forward: ESC+d (readline Meta-d).
  if (key.meta && input === "d") {
    const boundary = findNextWordBoundary(value, cursor);
    if (boundary > cursor) {
      return {
        value: value.slice(0, cursor) + value.slice(boundary),
        cursor,
      };
    }
    return { value, cursor };
  }

  // Single character backspace.
  if (key.backspace || key.delete) {
    if (cursor > 0) {
      return {
        value: value.slice(0, cursor - 1) + value.slice(cursor),
        cursor: cursor - 1,
      };
    }
    return { value, cursor };
  }

  // Word jump backward: Option+Left or ESC+b.
  if (key.meta && (input === "b" || key.leftArrow)) {
    return { value, cursor: findPreviousWordBoundary(value, cursor) };
  }

  // Word jump forward: Option+Right or ESC+f.
  if (key.meta && (input === "f" || key.rightArrow)) {
    return { value, cursor: findNextWordBoundary(value, cursor) };
  }

  // Cursor left.
  if (key.leftArrow) {
    return { value, cursor: Math.max(0, cursor - 1) };
  }

  // Cursor right.
  if (key.rightArrow) {
    return { value, cursor: Math.min(value.length, cursor + 1) };
  }

  // Not a text edit — let the caller handle it.
  if (key.ctrl || key.meta || key.tab || key.return || key.escape) {
    return null;
  }
  if (key.upArrow || key.downArrow) {
    return null;
  }

  // Insert printable character.
  return {
    value: value.slice(0, cursor) + input + value.slice(cursor),
    cursor: cursor + input.length,
  };
}
