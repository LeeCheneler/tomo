import { describe, expect, it } from "vitest";
import { getCommand } from "./registry";

// Import to trigger registration
import "./tools";

describe("/tools command", () => {
  it("is registered", () => {
    const cmd = getCommand("tools");
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("tools");
    expect(cmd?.description).toBe("Manage tool availability");
  });

  it("returns an interactive element", () => {
    const cmd = getCommand("tools");
    const result = cmd?.execute("", {
      onComplete: () => {},
      onCancel: () => {},
    } as never);

    expect(result).toBeDefined();
    expect(result).toHaveProperty("interactive");
  });
});
