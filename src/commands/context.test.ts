import { describe, expect, it } from "vitest";
import type { CommandContext } from "./registry";
import { createCommandRegistry } from "./registry";
import { contextCommand } from "./context";

describe("contextCommand", () => {
  it("is named context", () => {
    expect(contextCommand.name).toBe("context");
  });

  it("has a description", () => {
    expect(contextCommand.description).toBeTruthy();
  });

  it("shows no usage message when usage is null", async () => {
    const registry = createCommandRegistry();
    registry.register(contextCommand);
    const context: CommandContext = {
      usage: null,
      contextWindow: 8192,
      resetSession: () => {},
      loadSession: () => {},
    };
    const result = await registry.invoke("/context", context);
    expect(result.type).toBe("inline");
    if (result.type !== "inline") return;
    expect(result.output).toContain("No usage data yet");
  });

  it("formats token usage with progress bar and percentage", async () => {
    const registry = createCommandRegistry();
    registry.register(contextCommand);
    const context: CommandContext = {
      usage: { promptTokens: 1000, completionTokens: 500 },
      contextWindow: 8192,
      resetSession: () => {},
      loadSession: () => {},
    };
    const result = await registry.invoke("/context", context);
    expect(result.type).toBe("inline");
    if (result.type !== "inline") return;
    expect(result.output).toContain("█");
    expect(result.output).toContain("░");
    expect(result.output).toContain("1,500");
    expect(result.output).toContain("8,192");
    expect(result.output).toContain("18%");
  });
});
