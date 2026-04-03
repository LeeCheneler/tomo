import { describe, expect, it } from "vitest";
import { createCommandRegistry } from "./registry";

describe("createCommandRegistry", () => {
  it("registers and retrieves a command", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "ping",
      description: "Responds with pong",
      handler: () => "pong",
    });
    const command = registry.get("ping");
    expect(command).toBeDefined();
    expect(command?.name).toBe("ping");
  });

  it("returns undefined for an unregistered command", () => {
    const registry = createCommandRegistry();
    expect(registry.get("nope")).toBeUndefined();
  });

  it("lists all registered commands", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "ping",
      description: "Responds with pong",
      handler: () => "pong",
    });
    registry.register({
      name: "help",
      description: "Shows help",
      handler: () => "help text",
    });
    const commands = registry.list();
    expect(commands).toHaveLength(2);
    expect(commands.map((c) => c.name)).toEqual(["ping", "help"]);
  });

  it("overwrites a command when registering the same name", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "ping",
      description: "Old",
      handler: () => "old",
    });
    registry.register({
      name: "ping",
      description: "New",
      handler: () => "new",
    });
    const command = registry.get("ping");
    expect(command?.description).toBe("New");
    expect(registry.list()).toHaveLength(1);
  });

  it("executes a command handler", () => {
    const registry = createCommandRegistry();
    registry.register({
      name: "ping",
      description: "Responds with pong",
      handler: () => "pong",
    });
    const command = registry.get("ping");
    expect(command?.handler?.()).toBe("pong");
  });

  describe("invoke", () => {
    it("returns an inline result for handler commands", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const result = await registry.invoke("/ping");
      expect(result.type).toBe("inline");
      expect(result.name).toBe("ping");
      if (result.type === "inline") {
        expect(result.output).toBe("pong");
      }
    });

    it("parses command name from first word", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "echo",
        description: "Echoes input",
        handler: () => "echoed",
      });
      const result = await registry.invoke("/echo hello world");
      expect(result.name).toBe("echo");
      if (result.type === "inline") {
        expect(result.output).toBe("echoed");
      }
    });

    it("returns an inline error for unknown commands", async () => {
      const registry = createCommandRegistry();
      const result = await registry.invoke("/nope");
      expect(result.type).toBe("inline");
      expect(result.name).toBe("nope");
      if (result.type === "inline") {
        expect(result.output).toContain("Unknown command");
      }
    });

    it("handles async handlers", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "slow",
        description: "Async command",
        handler: async () => "done",
      });
      const result = await registry.invoke("/slow");
      if (result.type === "inline") {
        expect(result.output).toBe("done");
      }
    });

    it("returns a takeover result for takeover commands", async () => {
      const render = () => null;
      const registry = createCommandRegistry();
      registry.register({
        name: "settings",
        description: "Manage settings",
        takeover: render,
      });
      const result = await registry.invoke("/settings");
      expect(result.type).toBe("takeover");
      expect(result.name).toBe("settings");
      if (result.type === "takeover") {
        expect(result.render).toBe(render);
      }
    });
  });
});
