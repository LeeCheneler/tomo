import { describe, expect, it } from "vitest";
import { stripAnsi } from "../utils/strip-ansi";
import { completePartialMarkdown, renderMarkdown } from "./render";

describe("renderMarkdown", () => {
  it("renders plain text", () => {
    const result = renderMarkdown("Hello, world!");
    expect(stripAnsi(result)).toContain("Hello, world!");
  });

  it("returns empty string for empty input", () => {
    expect(renderMarkdown("")).toBe("");
  });

  it("renders bold text", () => {
    const result = renderMarkdown("**bold**");
    expect(stripAnsi(result)).toContain("bold");
  });

  it("renders italic text", () => {
    const result = renderMarkdown("*italic*");
    expect(stripAnsi(result)).toContain("italic");
  });

  it("renders inline code", () => {
    const result = renderMarkdown("`code`");
    expect(stripAnsi(result)).toContain("code");
  });

  it("renders strikethrough text", () => {
    const result = renderMarkdown("~~deleted~~");
    expect(stripAnsi(result)).toContain("deleted");
  });

  it("renders links with URL", () => {
    const result = renderMarkdown("[text](https://example.com)");
    expect(stripAnsi(result)).toContain("text");
    expect(stripAnsi(result)).toContain("https://example.com");
  });

  it("renders h1 headings", () => {
    const result = renderMarkdown("# Heading");
    expect(stripAnsi(result)).toContain("# Heading");
  });

  it("renders h2 headings", () => {
    const result = renderMarkdown("## Subheading");
    expect(stripAnsi(result)).toContain("## Subheading");
  });

  it("renders h3 headings", () => {
    const result = renderMarkdown("### Deep");
    expect(stripAnsi(result)).toContain("### Deep");
  });

  it("renders unordered lists with bullets", () => {
    const result = renderMarkdown("- item 1\n- item 2");
    const plain = stripAnsi(result);
    expect(plain).toContain("•");
    expect(plain).toContain("item 1");
    expect(plain).toContain("item 2");
  });

  it("renders ordered lists with numbers", () => {
    const result = renderMarkdown("1. first\n2. second");
    const plain = stripAnsi(result);
    expect(plain).toContain("1.");
    expect(plain).toContain("first");
    expect(plain).toContain("second");
  });

  it("renders code blocks with indentation", () => {
    const result = renderMarkdown("```js\nconst x = 1;\n```");
    const plain = stripAnsi(result);
    expect(plain).toContain("const");
    expect(plain).toContain("x");
    // Code blocks are indented with 4 spaces
    expect(result).toContain("    ");
  });

  it("renders code blocks without language", () => {
    const result = renderMarkdown("```\nplain code\n```");
    expect(stripAnsi(result)).toContain("plain code");
  });

  it("renders blockquotes", () => {
    const result = renderMarkdown("> quoted text");
    const plain = stripAnsi(result);
    expect(plain).toContain("│");
    expect(plain).toContain("quoted text");
  });

  it("renders horizontal rules", () => {
    const result = renderMarkdown("---");
    expect(stripAnsi(result)).toContain("─");
  });

  it("renders markdown tables with box drawing", () => {
    const table = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
    const result = renderMarkdown(table);
    const plain = stripAnsi(result);
    expect(plain).toContain("Name");
    expect(plain).toContain("Alice");
    expect(plain).toContain("Bob");
    expect(plain).toContain("┌");
    expect(plain).toContain("│");
    expect(plain).toContain("└");
  });

  it("renders HTML tables with box drawing", () => {
    const html =
      "<table><thead><tr><th>Task</th><th>Status</th></tr></thead><tbody><tr><td>Build</td><td>Done</td></tr></tbody></table>";
    const result = renderMarkdown(html);
    const plain = stripAnsi(result);
    expect(plain).toContain("Task");
    expect(plain).toContain("Build");
    expect(plain).toContain("Done");
    expect(plain).toContain("┌");
    expect(plain).not.toContain("<table>");
    expect(plain).not.toContain("<td>");
  });

  it("wraps wide table cells to fit terminal width", () => {
    const original = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 40,
      writable: true,
      configurable: true,
    });
    try {
      const table =
        "| Name | Description |\n| --- | --- |\n| Alice | A very long description that should wrap inside the cell |";
      const result = renderMarkdown(table);
      for (const line of result.split("\n")) {
        expect(stripAnsi(line).length).toBeLessThanOrEqual(40);
      }
      const plain = stripAnsi(result);
      expect(plain).toContain("Alice");
      expect(plain).toContain("should");
      expect(plain).toContain("wrap");
    } finally {
      Object.defineProperty(process.stdout, "columns", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });

  it("wraps long words without spaces in table cells", () => {
    const original = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 30,
      writable: true,
      configurable: true,
    });
    try {
      const table =
        "| Key | Value |\n| --- | --- |\n| x | abcdefghijklmnopqrstuvwxyz |";
      const result = renderMarkdown(table);
      const plain = stripAnsi(result);
      expect(plain).toContain("abcdefgh");
      expect(plain).toContain("┌");
    } finally {
      Object.defineProperty(process.stdout, "columns", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });

  it("handles HTML without table structure", () => {
    const result = renderMarkdown("<tr><td>orphan</td></tr>");
    const plain = stripAnsi(result);
    expect(plain).toContain("orphan");
  });

  it("strips non-table HTML tags", () => {
    const result = renderMarkdown("<div>hello</div>");
    const plain = stripAnsi(result);
    expect(plain).toContain("hello");
    expect(plain).not.toContain("<div>");
  });

  it("falls back to plain text when syntax highlighting fails", () => {
    // Use a language that cli-highlight doesn't recognize to trigger the catch branch
    const result = renderMarkdown("```thisisnotareallanguage\nsome code\n```");
    expect(stripAnsi(result)).toContain("some code");
  });

  it("renders line breaks", () => {
    const result = renderMarkdown("line one  \nline two");
    expect(stripAnsi(result)).toContain("line one");
    expect(stripAnsi(result)).toContain("line two");
  });

  it("stops shrinking table columns at minimum width", () => {
    const original = process.stdout.columns;
    // 3 columns: overhead = 3*3+1 = 10, available = 15-10 = 5.
    // Initial widths 4+4+4 = 12 > 5, shrinks until all columns hit minColWidth (3).
    Object.defineProperty(process.stdout, "columns", {
      value: 15,
      writable: true,
      configurable: true,
    });
    try {
      const table =
        "| Col1 | Col2 | Col3 |\n| --- | --- | --- |\n| a | b | c |";
      const result = renderMarkdown(table);
      const plain = stripAnsi(result);
      expect(plain).toContain("┌");
      expect(plain).toContain("a");
    } finally {
      Object.defineProperty(process.stdout, "columns", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });

  it("handles HTML table rows without cells", () => {
    const html = "<table><tr></tr><tr><td>data</td></tr></table>";
    const result = renderMarkdown(html);
    const plain = stripAnsi(result);
    // The empty row is skipped, data row renders
    expect(plain).toContain("data");
  });

  it("strips HTML when all table rows are empty", () => {
    const html = "<table><tr></tr><tr></tr></table>";
    const result = renderMarkdown(html);
    const plain = stripAnsi(result);
    // No table structure since no cells found
    expect(plain).not.toContain("┌");
  });

  it("handles HTML table with uneven row lengths", () => {
    const html =
      "<table><tr><th>A</th><th>B</th><th>C</th></tr><tr><td>1</td></tr></table>";
    const result = renderMarkdown(html);
    const plain = stripAnsi(result);
    expect(plain).toContain("A");
    expect(plain).toContain("1");
    expect(plain).toContain("┌");
  });

  it("unescapes HTML entities", () => {
    const result = renderMarkdown("I'm happy & you're \"great\" < >");
    const plain = stripAnsi(result);
    expect(plain).toContain("I'm happy & you're");
    expect(plain).not.toContain("&#39;");
    expect(plain).not.toContain("&amp;");
    expect(plain).not.toContain("&quot;");
  });
});

describe("completePartialMarkdown", () => {
  it("returns text unchanged when no code fences", () => {
    expect(completePartialMarkdown("hello world")).toBe("hello world");
  });

  it("returns text unchanged when code fences are balanced", () => {
    const text = "```js\nconst x = 1;\n```";
    expect(completePartialMarkdown(text)).toBe(text);
  });

  it("closes an unclosed backtick fence", () => {
    const text = "```python\nprint('hi')";
    expect(completePartialMarkdown(text)).toBe(`${text}\n\`\`\``);
  });

  it("closes an unclosed tilde fence", () => {
    const text = "~~~\nsome code";
    expect(completePartialMarkdown(text)).toBe(`${text}\n~~~`);
  });

  it("matches fence length when closing", () => {
    const text = "````\ncode";
    expect(completePartialMarkdown(text)).toBe(`${text}\n\`\`\`\``);
  });

  it("handles multiple code blocks with last one unclosed", () => {
    const text = "```js\nconst x = 1;\n```\n\ntext\n\n```py\nprint('hi')";
    expect(completePartialMarkdown(text)).toBe(`${text}\n\`\`\``);
  });

  it("does not close when shorter fence appears inside block", () => {
    const text = "````\nsome ```\nstill open";
    expect(completePartialMarkdown(text)).toBe(`${text}\n\`\`\`\``);
  });

  it("handles fence with only opening line and no content", () => {
    const text = "some text\n```";
    expect(completePartialMarkdown(text)).toBe(`${text}\n\`\`\``);
  });

  it("returns empty string unchanged", () => {
    expect(completePartialMarkdown("")).toBe("");
  });
});
