import { describe, expect, it, vi } from "vitest";
import type { CommandContext } from "./registry";
import { createCommandRegistry } from "./registry";
import { newCommand } from "./new";

describe("newCommand", () => {
  it("is named new", () => {
    expect(newCommand.name).toBe("new");
  });

  it("has a description", () => {
    expect(newCommand.description).toBeTruthy();
  });

  it("calls resetSession and returns confirmation", async () => {
    const resetSession = vi.fn();
    const registry = createCommandRegistry();
    registry.register(newCommand);
    const context: CommandContext = {
      usage: null,
      contextWindow: 8192,
      resetSession,
      loadSession: () => {},
    };
    const result = await registry.invoke("/new", context);
    expect(resetSession).toHaveBeenCalledOnce();
    expect(result.type).toBe("inline");
    if (result.type === "inline") {
      expect(result.output).toContain("new session");
    }
  });
});
