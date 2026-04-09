import { describe, expect, it } from "vitest";
import { renderInk } from "../../test-utils/ink";
import { Hint } from "./hint";

describe("Hint", () => {
  it("renders children as dim text", () => {
    const { lastFrame } = renderInk(<Hint>press enter to select</Hint>);
    expect(lastFrame()).toContain("press enter to select");
  });
});
