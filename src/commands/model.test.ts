import { createElement, Fragment } from "react";
import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import type { CommandContext } from "./registry";
import { modelCommand } from "./model";
import { createCommandRegistry } from "./registry";

/** Default context for tests. */
const DEFAULT_CONTEXT: CommandContext = { usage: null, contextWindow: 8192 };

describe("modelCommand", () => {
  it("is named model", () => {
    expect(modelCommand.name).toBe("model");
  });

  it("registers and invokes as a takeover", async () => {
    const registry = createCommandRegistry();
    registry.register(modelCommand);
    const result = await registry.invoke("/model", DEFAULT_CONTEXT);
    expect(result.type).toBe("takeover");
  });

  it("renders the model selector when invoked", async () => {
    const registry = createCommandRegistry();
    registry.register(modelCommand);
    const result = await registry.invoke("/model", DEFAULT_CONTEXT);
    if (result.type !== "takeover") return;
    const onDone = vi.fn();
    const { lastFrame } = renderInk(
      createElement(Fragment, null, result.render(onDone)),
    );
    expect(lastFrame()).toContain("Select Model");
  });

  it("has a description", () => {
    expect(modelCommand.description).toBeTruthy();
  });
});
