import { beforeEach, describe, expect, it } from "vitest";
import { getAllCommands, getCommand, parse, register } from "./registry";
import type { Command } from "./types";

const makeCommand = (name: string, description = "test"): Command => ({
  name,
  description,
  execute: () => ({ output: `${name} executed` }),
});

describe("parse", () => {
  it("returns null for non-command input", () => {
    expect(parse("hello world")).toBeNull();
    expect(parse("")).toBeNull();
    expect(parse("  just text  ")).toBeNull();
  });

  it("parses a command with no args", () => {
    expect(parse("/help")).toEqual({ name: "help", args: "" });
  });

  it("parses a command with args", () => {
    expect(parse("/resume session-123")).toEqual({
      name: "resume",
      args: "session-123",
    });
  });

  it("trims whitespace from input and args", () => {
    expect(parse("  /help  ")).toEqual({ name: "help", args: "" });
    expect(parse("/resume   foo bar  ")).toEqual({
      name: "resume",
      args: "foo bar",
    });
  });
});

describe("register / getCommand / getAllCommands", () => {
  beforeEach(() => {
    // Register a fresh command for each test
    register(makeCommand("testcmd", "a test command"));
  });

  it("registers and retrieves a command", () => {
    const cmd = getCommand("testcmd");
    expect(cmd).toBeDefined();
    expect(cmd?.name).toBe("testcmd");
    expect(cmd?.description).toBe("a test command");
  });

  it("returns undefined for unknown commands", () => {
    expect(getCommand("nonexistent")).toBeUndefined();
  });

  it("lists all registered commands", () => {
    register(makeCommand("another"));
    const all = getAllCommands();
    const names = all.map((c) => c.name);
    expect(names).toContain("testcmd");
    expect(names).toContain("another");
  });
});
