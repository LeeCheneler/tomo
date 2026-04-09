import { afterEach, describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { Border } from "./border";

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("Border", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  it("renders a border at the terminal width", () => {
    setColumns(40);
    const { lastFrame } = renderInk(<Border />);
    expect(lastFrame()).toBe("─".repeat(40));
  });

  it("falls back to 80 columns when undefined", () => {
    setColumns(undefined);
    const { lastFrame } = renderInk(<Border />);
    expect(lastFrame()).toBe("─".repeat(80));
  });

  it("renders with the specified color", () => {
    setColumns(10);
    const { lastFrame } = renderInk(<Border color="cyan" />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("─".repeat(10));
  });
});
