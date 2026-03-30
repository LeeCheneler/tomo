import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { Heading } from "./heading";

describe("Heading", () => {
  it("renders children as bold text", () => {
    const { lastFrame } = render(<Heading>Settings</Heading>);
    expect(lastFrame()).toContain("Settings");
  });
});
