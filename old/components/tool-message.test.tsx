import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { ToolMessage } from "./tool-message";

describe("ToolMessage", () => {
  it("renders only the header line", () => {
    const content = "header\nline 1\nline 2\nline 3";
    const { lastFrame } = render(<ToolMessage>{content}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header");
    expect(output).not.toContain("line 1");
    expect(output).not.toContain("line 2");
    expect(output).not.toContain("line 3");
  });

  it("renders header-only content", () => {
    const { lastFrame } = render(<ToolMessage>{"header only"}</ToolMessage>);

    expect(lastFrame()).toContain("header only");
  });

  it("does not show body lines or collapse indicator", () => {
    const lines = [
      "header line",
      ...Array.from({ length: 10 }, (_, i) => `line ${i + 1}`),
    ];
    const content = lines.join("\n");
    const { lastFrame } = render(<ToolMessage>{content}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header line");
    expect(output).not.toContain("line 1");
    expect(output).not.toContain("more lines");
  });
});
