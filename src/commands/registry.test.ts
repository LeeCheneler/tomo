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
    expect(command?.handler()).toBe("pong");
  });

  describe("invoke", () => {
    it("parses command name and returns a CommandMessage", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "ping",
        description: "Responds with pong",
        handler: () => "pong",
      });
      const message = await registry.invoke("/ping");
      expect(message.role).toBe("command");
      expect(message.command).toBe("ping");
      expect(message.result).toBe("pong");
      expect(message.id).toBeDefined();
    });

    it("parses command name from first word", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "echo",
        description: "Echoes input",
        handler: () => "echoed",
      });
      const message = await registry.invoke("/echo hello world");
      expect(message.command).toBe("echo");
      expect(message.result).toBe("echoed");
    });

    it("returns an error message for unknown commands", async () => {
      const registry = createCommandRegistry();
      const message = await registry.invoke("/nope");
      expect(message.command).toBe("nope");
      expect(message.result).toContain("Unknown command");
    });

    it("handles async handlers", async () => {
      const registry = createCommandRegistry();
      registry.register({
        name: "slow",
        description: "Async command",
        handler: async () => "done",
      });
      const message = await registry.invoke("/slow");
      expect(message.result).toBe("done");
    });
  });
});
