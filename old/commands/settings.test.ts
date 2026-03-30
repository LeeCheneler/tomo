import { describe, expect, it } from "vitest";
import { getCommand } from "./registry";

// Import to trigger registration
import "./settings";

describe("/settings command", () => {
  it("is registered", () => {
    const command = getCommand("settings");
    expect(command).toBeDefined();
    expect(command?.name).toBe("settings");
  });

  it("has a description", () => {
    const command = getCommand("settings");
    expect(command?.description).toBe(
      "Manage tools, permissions, commands, and MCP servers",
    );
  });
});
