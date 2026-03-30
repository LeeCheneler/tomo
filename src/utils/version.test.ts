import { afterEach, describe, expect, it, vi } from "vitest";

describe("version", () => {
  afterEach(() => {
    vi.resetModules();
    delete (globalThis as Record<string, unknown>).TOMO_VERSION;
  });

  it("defaults to 'dev' when TOMO_VERSION is not defined", async () => {
    const { version } = await import("./version");
    expect(version).toBe("dev");
  });

  it("uses TOMO_VERSION when defined", async () => {
    (globalThis as Record<string, unknown>).TOMO_VERSION = "1.2.3";
    const { version } = await import("./version");
    expect(version).toBe("1.2.3");
  });
});
