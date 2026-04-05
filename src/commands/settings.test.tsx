import { createElement, Fragment } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import type { CommandContext } from "./registry";
import { createCommandRegistry } from "./registry";
import { settingsCommand } from "./settings";

/** Default context for tests. */
const DEFAULT_CONTEXT: CommandContext = {
  usage: null,
  contextWindow: 8192,
  resetSession: () => {},
};

describe("settingsCommand", () => {
  it("is named settings", () => {
    expect(settingsCommand.name).toBe("settings");
  });

  it("renders the settings menu when invoked", async () => {
    const registry = createCommandRegistry();
    registry.register(settingsCommand);
    const result = await registry.invoke("/settings", DEFAULT_CONTEXT);
    expect(result.type).toBe("takeover");
    if (result.type !== "takeover") return;
    const onDone = vi.fn();
    const { lastFrame } = renderInk(
      createElement(Fragment, null, result.render(onDone)),
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Settings");
    expect(frame).toContain("Providers");
  });

  it("has no handler", () => {
    expect(settingsCommand.handler).toBeUndefined();
  });

  it("has a description", () => {
    expect(settingsCommand.description).toBeTruthy();
  });
});
