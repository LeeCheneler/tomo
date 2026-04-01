import { describe, expect, it } from "vitest";
import { flushInkFrames } from "./flush-ink";

describe("flushInkFrames", () => {
  it("resolves after a short delay", async () => {
    const before = Date.now();
    await flushInkFrames();
    const elapsed = Date.now() - before;
    expect(elapsed).toBeGreaterThanOrEqual(30);
  });

  it("allows setImmediate callbacks to run", async () => {
    let called = false;
    setImmediate(() => {
      called = true;
    });
    expect(called).toBe(false);
    await flushInkFrames();
    expect(called).toBe(true);
  });
});
