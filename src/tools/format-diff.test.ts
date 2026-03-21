import { describe, expect, it } from "vitest";
import { formatDiff, formatNewFile } from "./format-diff";

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping ANSI escape codes
const stripAnsi = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, "");

describe("formatNewFile", () => {
  it("formats all lines as additions", () => {
    const result = formatNewFile("line1\nline2\nline3\n");
    const plain = stripAnsi(result);

    expect(plain).toContain("+ line1");
    expect(plain).toContain("+ line2");
    expect(plain).toContain("+ line3");
  });

  it("handles empty content", () => {
    const result = formatNewFile("");
    const plain = stripAnsi(result);

    expect(plain).toContain("+ ");
  });
});

describe("formatDiff", () => {
  it("shows additions and removals", () => {
    const result = formatDiff("old line\n", "new line\n");
    const plain = stripAnsi(result);

    expect(plain).toContain("- old line");
    expect(plain).toContain("+ new line");
  });

  it("shows context lines for unchanged content", () => {
    const old = "line1\nline2\nline3\n";
    const updated = "line1\nchanged\nline3\n";
    const result = formatDiff(old, updated);
    const plain = stripAnsi(result);

    expect(plain).toContain("  line1");
    expect(plain).toContain("- line2");
    expect(plain).toContain("+ changed");
    expect(plain).toContain("  line3");
  });

  it("shows no diff markers when content is identical", () => {
    const content = "same\n";
    const result = formatDiff(content, content);
    const plain = stripAnsi(result);

    expect(plain).not.toContain("+ ");
    expect(plain).not.toContain("- ");
    expect(plain).toContain("  same");
  });
});
