import { describe, expect, it } from "vitest";
import {
  findNextWordBoundary,
  findPreviousWordBoundary,
  getCursorLineInfo,
  isWordChar,
  lineColumnToPos,
  splitAtCursor,
} from "./cursor";

describe("isWordChar", () => {
  it("returns true for alphanumeric characters", () => {
    expect(isWordChar("a")).toBe(true);
    expect(isWordChar("Z")).toBe(true);
    expect(isWordChar("5")).toBe(true);
  });

  it("returns true for underscore", () => {
    expect(isWordChar("_")).toBe(true);
  });

  it("returns false for non-word characters", () => {
    expect(isWordChar(" ")).toBe(false);
    expect(isWordChar("-")).toBe(false);
    expect(isWordChar(".")).toBe(false);
  });
});

describe("findPreviousWordBoundary", () => {
  it("returns 0 when at start", () => {
    expect(findPreviousWordBoundary("hello", 0)).toBe(0);
  });

  it("jumps to start of current word", () => {
    expect(findPreviousWordBoundary("hello world", 8)).toBe(6);
  });

  it("skips non-word characters then the word", () => {
    expect(findPreviousWordBoundary("hello  world", 7)).toBe(0);
  });

  it("handles position at end of value", () => {
    expect(findPreviousWordBoundary("hello world", 11)).toBe(6);
  });
});

describe("findNextWordBoundary", () => {
  it("jumps to end of next word", () => {
    expect(findNextWordBoundary("hello world", 0)).toBe(5);
  });

  it("skips non-word characters first", () => {
    expect(findNextWordBoundary("hello world", 5)).toBe(11);
  });

  it("returns value length when at end", () => {
    expect(findNextWordBoundary("hello", 5)).toBe(5);
  });
});

describe("getCursorLineInfo", () => {
  it("returns line and column for single line", () => {
    const result = getCursorLineInfo("hello", 3);
    expect(result.lineIndex).toBe(0);
    expect(result.column).toBe(3);
  });

  it("returns correct line for multi-line value", () => {
    const result = getCursorLineInfo("abc\ndef", 5);
    expect(result.lineIndex).toBe(1);
    expect(result.column).toBe(1);
  });

  it("handles cursor at newline boundary", () => {
    const result = getCursorLineInfo("abc\ndef", 3);
    expect(result.lineIndex).toBe(0);
    expect(result.column).toBe(3);
  });
});

describe("lineColumnToPos", () => {
  it("converts first line position", () => {
    expect(lineColumnToPos(["abc", "def"], 0, 2)).toBe(2);
  });

  it("converts second line position", () => {
    expect(lineColumnToPos(["abc", "def"], 1, 1)).toBe(5);
  });

  it("clamps column to line length", () => {
    expect(lineColumnToPos(["ab", "cd"], 0, 10)).toBe(2);
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
