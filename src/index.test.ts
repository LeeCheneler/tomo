import { describe, it, expect } from "vitest";

describe("app module", () => {
  it("can be imported", async () => {
    const mod = await import("./index");
    expect(mod).toBeDefined();
  });
});
