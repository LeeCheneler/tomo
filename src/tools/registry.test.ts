import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolRegistry } from "./registry";
import type { Tool } from "./types";
import { ok } from "./types";

/** Creates a minimal stub tool for testing. */
function stubTool(name: string): Tool {
  return {
    name,
    displayName: name,
    description: `Description for ${name}`,
    parameters: { type: "object", properties: {} },
    argsSchema: z.object({}),
    formatCall: () => "",
    execute: async () => ok("done"),
  };
}

describe("createToolRegistry", () => {
  it("registers and retrieves a tool", () => {
    const registry = createToolRegistry();
    const tool = stubTool("read_file");
    registry.register(tool);
    expect(registry.get("read_file")).toBe(tool);
  });

  it("returns undefined for unregistered tool", () => {
    const registry = createToolRegistry();
    expect(registry.get("nope")).toBeUndefined();
  });

  it("lists all registered tools", () => {
    const registry = createToolRegistry();
    registry.register(stubTool("a"));
    registry.register(stubTool("b"));
    expect(registry.list().map((t) => t.name)).toEqual(["a", "b"]);
  });

  it("overwrites a tool when registering the same name", () => {
    const registry = createToolRegistry();
    registry.register(stubTool("a"));
    const replacement = stubTool("a");
    replacement.description = "replaced";
    registry.register(replacement);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get("a")?.description).toBe("replaced");
  });

  it("removes a tool with unregister", () => {
    const registry = createToolRegistry();
    registry.register(stubTool("a"));
    registry.register(stubTool("b"));
    registry.unregister("a");
    expect(registry.get("a")).toBeUndefined();
    expect(registry.list().map((t) => t.name)).toEqual(["b"]);
  });

  it("unregister is a no-op for unknown names", () => {
    const registry = createToolRegistry();
    registry.register(stubTool("a"));
    registry.unregister("nonexistent");
    expect(registry.list()).toHaveLength(1);
  });

  it("returns OpenAI-compatible tool definitions", () => {
    const registry = createToolRegistry();
    registry.register(stubTool("read_file"));
    const defs = registry.getDefinitions();
    expect(defs).toHaveLength(1);
    expect(defs[0]).toEqual({
      type: "function",
      function: {
        name: "read_file",
        description: "Description for read_file",
        parameters: { type: "object", properties: {} },
      },
    });
  });
});
