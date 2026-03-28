import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { completePartialMarkdown, Markdown } from "./markdown";

describe("Markdown", () => {
  it("renders bold text", () => {
    const { lastFrame } = render(<Markdown>{"**bold**"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("bold");
  });

  it("renders italic text", () => {
    const { lastFrame } = render(<Markdown>{"*italic*"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("italic");
  });

  it("renders inline code", () => {
    const { lastFrame } = render(<Markdown>{"`code`"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("code");
  });

  it("renders headings", () => {
    const { lastFrame } = render(<Markdown>{"# Heading"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("Heading");
  });

  it("renders unordered lists", () => {
    const { lastFrame } = render(<Markdown>{"- item 1\n- item 2"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("item 1");
    expect(output).toContain("item 2");
  });

  it("renders ordered lists", () => {
    const { lastFrame } = render(<Markdown>{"1. first\n2. second"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("first");
    expect(output).toContain("second");
  });

  it("renders code blocks", () => {
    const { lastFrame } = render(
      <Markdown>{"```js\nconst x = 1;\n```"}</Markdown>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("const");
    expect(output).toContain("x");
  });

  it("renders plain text without markdown", () => {
    const { lastFrame } = render(<Markdown>{"Hello, world!"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("Hello, world!");
  });

  it("handles empty string", () => {
    const { lastFrame } = render(<Markdown>{""}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toBe("");
  });

  it("unescapes HTML entities", () => {
    const { lastFrame } = render(
      <Markdown>{"I'm happy & you're \"great\" < >"}</Markdown>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("I'm happy & you're");
    expect(output).not.toContain("&#39;");
    expect(output).not.toContain("&amp;");
    expect(output).not.toContain("&quot;");
  });

  it("renders markdown tables with box drawing", () => {
    const table = "| Name | Age |\n| --- | --- |\n| Alice | 30 |\n| Bob | 25 |";
    const { lastFrame } = render(<Markdown>{table}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("Name");
    expect(output).toContain("Alice");
    expect(output).toContain("Bob");
    expect(output).toContain("┌");
    expect(output).toContain("│");
    expect(output).toContain("└");
  });

  it("renders HTML tables with box drawing", () => {
    const html =
      "<table><thead><tr><th>Task</th><th>Status</th></tr></thead><tbody><tr><td>Build</td><td>Done</td></tr></tbody></table>";
    const { lastFrame } = render(<Markdown>{html}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("Task");
    expect(output).toContain("Build");
    expect(output).toContain("Done");
    expect(output).toContain("┌");
    expect(output).not.toContain("<table>");
    expect(output).not.toContain("<td>");
  });

  it("wraps wide table cell content to fit terminal width", () => {
    const original = process.stdout.columns;
    Object.defineProperty(process.stdout, "columns", {
      value: 40,
      writable: true,
      configurable: true,
    });
    try {
      const table =
        "| Name | Description |\n| --- | --- |\n| Alice | A very long description that should wrap inside the cell |";
      const { lastFrame } = render(<Markdown>{table}</Markdown>);
      const output = lastFrame() ?? "";
      // Every line of the table should fit within terminal width
      for (const line of output.split("\n")) {
        const visible = line.replace(
          // biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escape codes
          /\x1b\[[0-9;]*m/g,
          "",
        );
        expect(visible.length).toBeLessThanOrEqual(40);
      }
      // Full content should be present across wrapped lines, not truncated
      expect(output).toContain("Alice");
      expect(output).toContain("should");
      expect(output).toContain("wrap");
      expect(output).toContain("┌");
    } finally {
      Object.defineProperty(process.stdout, "columns", {
        value: original,
        writable: true,
        configurable: true,
      });
    }
  });

  it("strips non-table HTML tags", () => {
    const { lastFrame } = render(<Markdown>{"<div>hello</div>"}</Markdown>);
    const output = lastFrame() ?? "";
    expect(output).toContain("hello");
    expect(output).not.toContain("<div>");
  });

  it("re-renders with updated content (streaming simulation)", () => {
    const { lastFrame, rerender } = render(<Markdown>{"Hello"}</Markdown>);
    expect(lastFrame() ?? "").toContain("Hello");

    rerender(<Markdown>{"Hello **world**"}</Markdown>);
    expect(lastFrame() ?? "").toContain("world");
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
