import { describe, expect, it } from "vitest";
import { renderInk } from "../../test-utils/ink";
import { Heading } from "./heading";

describe("Heading", () => {
  it("renders children as bold text", () => {
    const { lastFrame } = renderInk(<Heading>Settings</Heading>);
    expect(lastFrame()).toContain("Settings");
  });
});
