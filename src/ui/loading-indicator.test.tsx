import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { LoadingIndicator } from "./loading-indicator";

describe("LoadingIndicator", () => {
  it("renders a spinner frame and the text", () => {
    const { lastFrame } = renderInk(<LoadingIndicator text="Loading..." />);
    const output = lastFrame() ?? "";
    expect(output).toContain("⠋");
    expect(output).toContain("Loading...");
  });

  it("animates the spinner over time", async () => {
    const { lastFrame } = renderInk(<LoadingIndicator text="Loading..." />);
    const initial = lastFrame() ?? "";

    await new Promise((r) => setTimeout(r, 200));

    const after = lastFrame() ?? "";
    expect(after).not.toBe(initial);
  });

  it("accepts a custom color", () => {
    const { lastFrame } = renderInk(
      <LoadingIndicator text="Connecting" color="red" />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("⠋");
    expect(output).toContain("Connecting");
  });

  it("cleans up the interval on unmount", () => {
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");
    const { unmount } = renderInk(<LoadingIndicator text="test" />);
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
