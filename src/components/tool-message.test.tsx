import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { ToolMessage } from "./tool-message";

describe("ToolMessage", () => {
  it("shows full content when 5 body lines or fewer", () => {
    const content = "header\nline 1\nline 2\nline 3";
    const { lastFrame } = render(<ToolMessage>{content}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header");
    expect(output).toContain("line 1");
    expect(output).toContain("line 3");
    expect(output).not.toContain("more lines");
  });

  it("truncates to last 5 body lines when content exceeds limit", () => {
    const lines = [
      "header line",
      ...Array.from({ length: 10 }, (_, i) => `line ${i + 1}`),
    ];
    const content = lines.join("\n");
    const { lastFrame } = render(<ToolMessage>{content}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header line");
    expect(output).toContain("line 6");
    expect(output).toContain("line 10");
    expect(output).not.toContain("line 1\n");
    expect(output).toContain("5 more lines");
    expect(output).toContain("more lines");
  });

  it("renders header-only content without body", () => {
    const { lastFrame } = render(<ToolMessage>{"header only"}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header only");
    expect(output).not.toContain("more lines");
  });

  it("renders body as dim text", () => {
    const { lastFrame } = render(
      <ToolMessage>{"header\nbody text"}</ToolMessage>,
    );

    expect(lastFrame()).toContain("body text");
  });
});
