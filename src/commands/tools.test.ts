import { describe, expect, it } from "vitest";
import { getCommand } from "./registry";

// Import to trigger registration
import "./tools";

describe("/tools command", () => {
  it("is registered", () => {
    const cmd = getCommand("tools");
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("tools");
    expect(cmd?.description).toBe("List available tools");
  });

  it("lists registered tools with name and description", () => {
    const cmd = getCommand("tools");
    const result = cmd?.execute("", {} as never);
    expect(result).toBeDefined();

    if (result && "output" in result) {
      // The "ask" tool should be registered from the tools index
      expect(result.output).toContain("ask");
    }
  });
});
