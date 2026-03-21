import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { ToolMessage } from "./tool-message";

describe("ToolMessage", () => {
  it("shows full content when 5 lines or fewer", () => {
    const content = "line 1\nline 2\nline 3";
    const { lastFrame } = render(
      <ToolMessage expanded={false}>{content}</ToolMessage>,
    );

    const output = lastFrame();
    expect(output).toContain("line 1");
    expect(output).toContain("line 3");
    expect(output).not.toContain("more lines");
  });

  it("shows last 5 lines when collapsed and content exceeds 5 lines", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");
    const { lastFrame } = render(
      <ToolMessage expanded={false}>{content}</ToolMessage>,
    );

    const output = lastFrame();
    // Should show last 5 lines
    expect(output).toContain("line 6");
    expect(output).toContain("line 10");
    // Should NOT show early lines
    expect(output).not.toContain("line 1\n");
    // Should show hidden count
    expect(output).toContain("5 more lines");
    expect(output).toContain("Tab to expand");
  });

  it("shows full content when expanded", () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
    const content = lines.join("\n");
    const { lastFrame } = render(
      <ToolMessage expanded={true}>{content}</ToolMessage>,
    );

    const output = lastFrame();
    expect(output).toContain("line 1");
    expect(output).toContain("line 10");
    expect(output).toContain("Tab to collapse");
  });

  it("renders content as dim text", () => {
    const { lastFrame } = render(
      <ToolMessage expanded={false}>{"hello"}</ToolMessage>,
    );

    // dimColor in Ink renders with ANSI dim codes
    expect(lastFrame()).toContain("hello");
  });
});
