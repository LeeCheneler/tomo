import { describe, expect, it } from "vitest";
import { mockToolContext } from "./stub-context";

describe("mockToolContext", () => {
  it("returns a valid ToolContext with defaults", async () => {
    const ctx = mockToolContext();
    expect(ctx.permissions.cwdReadFile).toBe(true);
    expect(ctx.permissions.cwdWriteFile).toBe(true);
    expect(ctx.signal).toBeInstanceOf(AbortSignal);
    expect(await ctx.confirm("test")).toBe(false);
    expect(await ctx.ask("test")).toBe("");
  });

  it("merges overrides", () => {
    const ctx = mockToolContext({
      permissions: {
        cwdReadFile: false,
        cwdWriteFile: false,
        globalReadFile: true,
        globalWriteFile: false,
      },
    });
    expect(ctx.permissions.cwdReadFile).toBe(false);
    expect(ctx.permissions.globalReadFile).toBe(true);
  });
});
