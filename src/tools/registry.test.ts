import { describe, expect, it } from "vitest";
import {
  getAllTools,
  getTool,
  getToolDefinitions,
  registerTool,
  resolveToolAvailability,
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

  it("resolves tool availability defaulting all to enabled", () => {
    registerTool(makeTool("test-avail-a"));
    registerTool(makeTool("test-avail-b"));

    const result = resolveToolAvailability();
    expect(result["test-avail-a"]).toBe(true);
    expect(result["test-avail-b"]).toBe(true);
  });

  it("resolves tool availability with overrides from config", () => {
    registerTool(makeTool("test-avail-c"));
    registerTool(makeTool("test-avail-d"));

    const result = resolveToolAvailability({ "test-avail-c": false });
    expect(result["test-avail-c"]).toBe(false);
    expect(result["test-avail-d"]).toBe(true);
  });

  it("filters tool definitions by availability", () => {
    registerTool(makeTool("test-filter-on"));
    registerTool(makeTool("test-filter-off"));

    const defs = getToolDefinitions({
      "test-filter-on": true,
      "test-filter-off": false,
    });

    expect(
      defs.find((d) => d.function.name === "test-filter-on"),
    ).toBeDefined();
    expect(
      defs.find((d) => d.function.name === "test-filter-off"),
    ).toBeUndefined();
  });

  it("returns all tools when no availability passed", () => {
    registerTool(makeTool("test-nofilter"));
    const defs = getToolDefinitions();
    expect(defs.find((d) => d.function.name === "test-nofilter")).toBeDefined();
  });

  it("respects tool enabled default when no config override", () => {
    const disabledTool = makeTool("test-disabled-default");
    disabledTool.enabled = false;
    registerTool(disabledTool);

    const enabledTool = makeTool("test-enabled-default");
    registerTool(enabledTool);

    const result = resolveToolAvailability();
    expect(result["test-disabled-default"]).toBe(false);
    expect(result["test-enabled-default"]).toBe(true);
  });

  it("config override takes priority over tool enabled default", () => {
    const disabledTool = makeTool("test-override-default");
    disabledTool.enabled = false;
    registerTool(disabledTool);

    const result = resolveToolAvailability({
      "test-override-default": true,
    });
    expect(result["test-override-default"]).toBe(true);
  });

  it("ignores non-registry config entries", () => {
    registerTool(makeTool("test-builtin"));

    const result = resolveToolAvailability({
      "test-builtin": true,
      mcp__server__read_file: false,
    });

    expect(result["test-builtin"]).toBe(true);
    expect(result.mcp__server__read_file).toBeUndefined();
  });
});
