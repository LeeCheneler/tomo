import { describe, expect, it } from "vitest";
import {
  getAllTools,
  getTool,
  getToolDefinitions,
  registerTool,
} from "./registry";
import type { Tool } from "./types";

function makeTool(name: string): Tool {
  return {
    name,
    description: `${name} description`,
    parameters: { type: "object", properties: {} },
    execute: async (_args, _context) => "result",
  };
}

// The registry is module-level state, so we need to re-import to reset.
// Instead, we register unique names per test to avoid collisions.

describe("tool registry", () => {
  it("registers and retrieves a tool by name", () => {
    const tool = makeTool("test-get");
    registerTool(tool);

    expect(getTool("test-get")).toBe(tool);
  });

  it("returns undefined for unregistered tool", () => {
    expect(getTool("nonexistent")).toBeUndefined();
  });

  it("lists all registered tools", () => {
    const tool = makeTool("test-list");
    registerTool(tool);

    const all = getAllTools();
    expect(all.find((t) => t.name === "test-list")).toBe(tool);
  });

  it("exports tool definitions in OpenAI format", () => {
    const tool = makeTool("test-export");
    registerTool(tool);

    const defs = getToolDefinitions();
    const def = defs.find((d) => d.function.name === "test-export");
    expect(def).toEqual({
      type: "function",
      function: {
        name: "test-export",
        description: "test-export description",
        parameters: { type: "object", properties: {} },
      },
    });
  });

  it("overwrites a tool with the same name", () => {
    const tool1 = makeTool("test-overwrite");
    const tool2 = makeTool("test-overwrite");
    tool2.description = "updated";
    registerTool(tool1);
    registerTool(tool2);

    expect(getTool("test-overwrite")?.description).toBe("updated");
  });
});
