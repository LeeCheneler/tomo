import { describe, expect, it } from "vitest";
import { stripAnsi } from "../utils/strip-ansi";
import { createHelpCommand, formatHelp } from "./help";
import type { CommandDefinition } from "./registry";
import { createCommandRegistry } from "./registry";

const fakeCommand = (name: string, description: string): CommandDefinition => ({
  name,
  description,
  handler: () => "",
});

describe("formatHelp", () => {
  it("renders all four sections", () => {
    const out = stripAnsi(
      formatHelp([fakeCommand("ping", "Responds with pong")]),
    );
    expect(out).toContain("Commands:");
    expect(out).toContain("Skills:");
    expect(out).toContain("Images:");
    expect(out).toContain("Tips:");
  });

  it("lists each command with its name and description", () => {
    const commands = [
      fakeCommand("alpha", "First command"),
      fakeCommand("beta", "Second command"),
    ];
    const out = stripAnsi(formatHelp(commands));
    expect(out).toContain("/alpha");
    expect(out).toContain("First command");
    expect(out).toContain("/beta");
    expect(out).toContain("Second command");
  });

  it("aligns command descriptions to the longest command name", () => {
    const commands = [
      fakeCommand("a", "DESC_A"),
      fakeCommand("eightlen", "DESC_B"),
    ];
    const out = stripAnsi(formatHelp(commands));
    const aLine = out.split("\n").find((l) => l.includes("DESC_A")) ?? "";
    const bLine = out.split("\n").find((l) => l.includes("DESC_B")) ?? "";
    expect(aLine.indexOf("DESC_A")).toBe(bLine.indexOf("DESC_B"));
  });

  it("mentions Tab as the pager shortcut in the Tips section", () => {
    const out = stripAnsi(formatHelp([fakeCommand("ping", "")]));
    expect(out).toContain("Tab");
    expect(out).toContain("pager");
  });

  it("mentions // for skills", () => {
    const out = stripAnsi(formatHelp([fakeCommand("ping", "")]));
    expect(out).toContain("//");
  });

  it("mentions image keybindings", () => {
    const out = stripAnsi(formatHelp([fakeCommand("ping", "")]));
    expect(out).toContain("Cmd+V");
    expect(out).toContain("Ctrl+V");
  });
});

describe("createHelpCommand", () => {
  it("creates a command named help", () => {
    const registry = createCommandRegistry();
    const help = createHelpCommand(registry);
    expect(help.name).toBe("help");
    expect(help.description).toBeTruthy();
  });

  it("includes itself when registered into a registry", async () => {
    const registry = createCommandRegistry();
    registry.register(createHelpCommand(registry));
    const result = await registry.invoke("/help", {
      usage: null,
      contextWindow: 8192,
      resetSession: () => {},
      loadSession: () => {},
    });
    expect(result.type).toBe("inline");
    if (result.type !== "inline") return;
    expect(stripAnsi(result.output)).toContain("/help");
  });

  it("lists every command registered in the registry", async () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "alpha",
      description: "First",
      handler: () => "a",
    });
    registry.register({
      name: "beta",
      description: "Second",
      handler: () => "b",
    });
    registry.register(createHelpCommand(registry));

    const result = await registry.invoke("/help", {
      usage: null,
      contextWindow: 8192,
      resetSession: () => {},
      loadSession: () => {},
    });
    expect(result.type).toBe("inline");
    if (result.type !== "inline") return;
    const out = stripAnsi(result.output);
    expect(out).toContain("/alpha");
    expect(out).toContain("/beta");
    expect(out).toContain("/help");
  });
});
