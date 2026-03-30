import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { Hint } from "./hint";

describe("Hint", () => {
  it("renders children as dim text", () => {
    const { lastFrame } = render(<Hint>press enter to select</Hint>);
    expect(lastFrame()).toContain("press enter to select");
  });
});
