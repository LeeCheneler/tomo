import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { HintBar } from "./hint-bar";

describe("HintBar", () => {
  it("renders label with hints", () => {
    const { lastFrame } = render(
      <HintBar
        label="MCP Servers"
        hints={[
          { key: "Space", action: "toggle" },
          { key: "Esc", action: "back" },
        ]}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("MCP Servers");
    expect(output).toContain("Space");
    expect(output).toContain("toggle");
    expect(output).toContain("Esc");
    expect(output).toContain("back");
  });

  it("renders without label", () => {
    const { lastFrame } = render(
      <HintBar
        hints={[
          { key: "Enter", action: "select" },
          { key: "Esc", action: "cancel" },
        ]}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Enter");
    expect(output).toContain("select");
    expect(output).not.toContain("):");
  });
});
