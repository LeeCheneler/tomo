import { describe, expect, it } from "vitest";
import type { CommandContext } from "./registry";
import { sessionCommand } from "./session";

/** Stub context for tests. */
const STUB_CONTEXT: CommandContext = {
  usage: null,
  contextWindow: 8192,
  resetSession: () => {},
  loadSession: () => {},
};

describe("sessionCommand", () => {
  it("is named session", () => {
    expect(sessionCommand.name).toBe("session");
  });

  it("has a description", () => {
    expect(sessionCommand.description).toBeTruthy();
  });

  it("is a takeover command that returns a React element", () => {
    const element = sessionCommand.takeover?.(() => {}, STUB_CONTEXT);
    expect(element).toBeDefined();
  });
});
