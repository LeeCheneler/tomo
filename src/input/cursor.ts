const WORD_CHAR = /\w/;

/** Returns true if the character is a word character (alphanumeric or underscore). */
export function isWordChar(ch: string): boolean {
  return WORD_CHAR.test(ch);
}

/** Finds the start of the previous word from the given position. */
export function findPreviousWordBoundary(value: string, pos: number): number {
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
export function findNextWordBoundary(value: string, pos: number): number {
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

/** Returns the line index and column offset for a cursor position within a value. */
export function getCursorLineInfo(value: string, pos: number) {
  const lines = value.split("\n");
  let remaining = pos;
  for (const [i, line] of lines.entries()) {
    if (remaining <= line.length) {
      return { lineIndex: i, column: remaining, lines };
    }
    // +1 accounts for the \n character.
    remaining -= line.length + 1;
  }
  // Unreachable when cursor is clamped correctly — the loop always matches
  // because the last line's length equals remaining when pos === value.length.
  /* v8 ignore next */
  throw new Error("Cursor position out of bounds");
}

/** Converts a line index and column back to an absolute cursor position. */
export function lineColumnToPos(
  lines: string[],
  lineIndex: number,
  column: number,
): number {
  let pos = 0;
  for (let i = 0; i < lineIndex; i++) {
    pos += lines[i].length + 1;
  }
  return pos + Math.min(column, lines[lineIndex].length);
}

/** Splits a value around a cursor position for rendering with an inverse block cursor. */
export function splitAtCursor(
  value: string,
  cursor: number,
): { before: string; at: string; after: string } {
  const ch = value[cursor];
  const placeholder = ch === undefined || ch === "\n";
  return {
    before: value.slice(0, cursor),
    at: placeholder ? " " : ch,
    after: placeholder ? value.slice(cursor) : value.slice(cursor + 1),
  };
}
