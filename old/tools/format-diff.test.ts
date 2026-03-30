import { describe, expect, it } from "vitest";
import { stripAnsi } from "../strip-ansi";
import { formatDiff, formatNewFile } from "./format-diff";

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

  it("returns no-changes message when content is identical", () => {
    const content = "same\n";
    const result = formatDiff(content, content);
    const plain = stripAnsi(result);

    expect(plain).toContain("(no changes)");
  });

  it("collapses distant unchanged lines into gap indicators", () => {
    // 10 lines, change only line 5 — should show context around it and gaps for the rest
    const lines = Array.from({ length: 10 }, (_, i) => `line${i + 1}`);
    const oldContent = `${lines.join("\n")}\n`;
    const newLines = [...lines];
    newLines[4] = "changed5";
    const newContent = `${newLines.join("\n")}\n`;

    const result = formatDiff(oldContent, newContent);
    const plain = stripAnsi(result);

    // Should show the change
    expect(plain).toContain("- line5");
    expect(plain).toContain("+ changed5");

    // Should show nearby context (lines 2-4 and 6-8)
    expect(plain).toContain("  line3");
    expect(plain).toContain("  line4");
    expect(plain).toContain("  line6");
    expect(plain).toContain("  line7");

    // Should have gap indicator for collapsed lines
    expect(plain).toContain("... ");
    expect(plain).toContain("more lines");
  });

  it("shows only context around changes for a large file edit", () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i + 1}`);
    const oldContent = `${lines.join("\n")}\n`;
    const newLines = [...lines];
    newLines[49] = "changed50";
    const newContent = `${newLines.join("\n")}\n`;

    const result = formatDiff(oldContent, newContent);
    const plain = stripAnsi(result);

    // Should NOT contain lines far from the change
    expect(plain).not.toContain("  line1");
    expect(plain).not.toContain("  line100");

    // Should contain the change and nearby context
    expect(plain).toContain("- line50");
    expect(plain).toContain("+ changed50");
    expect(plain).toContain("  line48");
    expect(plain).toContain("  line52");
  });
});
