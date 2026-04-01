import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { InstructionBar } from "./instruction-bar";

describe("InstructionBar", () => {
  it("renders a key in yellow followed by a dim description", () => {
    const { lastFrame } = renderInk(
      <InstructionBar items={[{ key: "enter", description: "submit" }]} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("enter");
    expect(frame).toContain("submit");
  });

  it("renders multiple items separated by a divider", () => {
    const { lastFrame } = renderInk(
      <InstructionBar
        items={[
          { key: "enter", description: "submit" },
          { key: "escape", description: "clear" },
        ]}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("enter");
    expect(frame).toContain("submit");
    expect(frame).toContain("escape");
    expect(frame).toContain("clear");
    expect(frame).toContain("·");
  });

  it("renders nothing when items array is empty", () => {
    const { lastFrame } = renderInk(<InstructionBar items={[]} />);
    expect(lastFrame()).toBe("");
  });
});
