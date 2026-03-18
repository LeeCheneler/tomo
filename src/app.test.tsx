import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { App } from "./app";

describe("App", () => {
  it("renders the logo and tagline", () => {
    const { lastFrame } = render(<App />);
    const output = lastFrame() ?? "";
    expect(output).toContain("╔╦╗╔═╗╔╦╗╔═╗");
    expect(output).toContain("友");
    expect(output).toContain("your local AI companion");
  });
});
