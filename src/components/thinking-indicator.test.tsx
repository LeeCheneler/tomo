import { render } from "ink-testing-library";
import { describe, it, expect, vi } from "vitest";
import { ThinkingIndicator } from "./thinking-indicator";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("ThinkingIndicator", () => {
  it("renders a spinner frame and the first verb", () => {
    const { lastFrame } = render(<ThinkingIndicator />);
    const output = lastFrame() ?? "";
    expect(output).toContain("⠋");
    expect(output).toContain("Thinking");
  });

  it("animates the spinner over time", async () => {
    const { lastFrame } = render(<ThinkingIndicator />);
    const initial = lastFrame() ?? "";

    // Wait enough ticks for the frame to advance
    await wait(200);

    const after = lastFrame() ?? "";
    // The spinner frame should have changed
    expect(after).not.toBe(initial);
  });

  it("eventually cycles to a different verb", async () => {
    const { lastFrame } = render(<ThinkingIndicator />);
    // "Thinking" shimmer cycle = (3 + 8 + 4) * 80ms = 1200ms
    // After that, verb should change to "Reasoning"
    await wait(1400);

    const output = lastFrame() ?? "";
    expect(output).toContain("Reasoning");
  });

  it("cleans up the interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = render(<ThinkingIndicator />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
