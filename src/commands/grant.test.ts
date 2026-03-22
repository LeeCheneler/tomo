import { describe, expect, it } from "vitest";
import { getCommand } from "./registry";

// Import to trigger registration
import "./grant";

describe("/grant command", () => {
  it("is registered", () => {
    const command = getCommand("grant");
    expect(command).toBeDefined();
    expect(command?.name).toBe("grant");
  });

  it("has a description", () => {
    const command = getCommand("grant");
    expect(command?.description).toBe("Manage tool permissions");
  });
});
