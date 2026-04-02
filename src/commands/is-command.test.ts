import { describe, expect, it } from "vitest";
import { isCommand } from "./is-command";

describe("isCommand", () => {
  it("returns true for a slash command", () => {
    expect(isCommand("/ping")).toBe(true);
  });

  it("returns true for a command with arguments", () => {
    expect(isCommand("/settings theme dark")).toBe(true);
  });

  it("returns false for a regular message", () => {
    expect(isCommand("hello world")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isCommand("")).toBe(false);
  });

  it("returns false for double slash", () => {
    expect(isCommand("//something")).toBe(false);
  });

  it("returns false for a slash with no command name", () => {
    expect(isCommand("/")).toBe(false);
  });

  it("returns false for a slash followed by a space", () => {
    expect(isCommand("/ something")).toBe(false);
  });
});
