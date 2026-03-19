import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { Markdown } from "./markdown";

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

  it("re-renders with updated content (streaming simulation)", () => {
    const { lastFrame, rerender } = render(<Markdown>{"Hello"}</Markdown>);
    expect(lastFrame() ?? "").toContain("Hello");

    rerender(<Markdown>{"Hello **world**"}</Markdown>);
    expect(lastFrame() ?? "").toContain("world");
  });
});
