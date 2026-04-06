import { describe, expect, it } from "vitest";
import { newFileDiff, unifiedDiff } from "./diff";

describe("unifiedDiff", () => {
  it("generates a diff with additions and removals", () => {
    const result = unifiedDiff("test.txt", "hello\nworld\n", "hello\nearth\n");

    expect(result).toContain("-world");
    expect(result).toContain("+earth");
    expect(result).toContain("@@");
  });

  it("includes context lines around changes", () => {
    const old = "a\nb\nc\nd\ne\n";
    const updated = "a\nb\nX\nd\ne\n";
    const result = unifiedDiff("test.txt", old, updated);

    expect(result).toContain(" a");
    expect(result).toContain(" b");
    expect(result).toContain("-c");
    expect(result).toContain("+X");
    expect(result).toContain(" d");
  });

  it("strips file header lines", () => {
    const result = unifiedDiff("test.txt", "a\n", "b\n");

    expect(result).not.toContain("---");
    expect(result).not.toContain("+++");
    expect(result).not.toContain("Index:");
  });

  it("returns empty string when content is identical", () => {
    const result = unifiedDiff("test.txt", "same\n", "same\n");

    expect(result).toBe("");
  });
});

describe("newFileDiff", () => {
  it("prefixes every line with +", () => {
    const result = newFileDiff("line one\nline two\nline three");

    expect(result).toBe("+line one\n+line two\n+line three");
  });

  it("handles single-line content", () => {
    const result = newFileDiff("hello");

    expect(result).toBe("+hello");
  });

  it("handles empty content", () => {
    const result = newFileDiff("");

    expect(result).toBe("+");
  });
});
