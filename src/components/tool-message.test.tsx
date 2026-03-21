import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { ToolMessage } from "./tool-message";

describe("ToolMessage", () => {
  it("shows header and body content", () => {
    const content = "header line\nline 1\nline 2\nline 3";
    const { lastFrame } = render(<ToolMessage>{content}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header line");
    expect(output).toContain("line 1");
    expect(output).toContain("line 3");
  });

  it("shows all lines regardless of count", () => {
    const lines = [
      "header line",
      ...Array.from({ length: 10 }, (_, i) => `line ${i + 1}`),
    ];
    const content = lines.join("\n");
    const { lastFrame } = render(<ToolMessage>{content}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header line");
    expect(output).toContain("line 1");
    expect(output).toContain("line 10");
  });

  it("renders body as dim text", () => {
    const { lastFrame } = render(
      <ToolMessage>{"header\nbody text"}</ToolMessage>,
    );

    expect(lastFrame()).toContain("body text");
  });

  it("renders header-only content without body", () => {
    const { lastFrame } = render(<ToolMessage>{"header only"}</ToolMessage>);

    const output = lastFrame();
    expect(output).toContain("header only");
  });
});
