import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Tool } from "./types";
import { parseToolArgs, toToolDefinition } from "./types";

describe("parseToolArgs", () => {
  const schema = z.object({
    path: z.string().min(1, "path is required"),
    count: z.number().int().positive().optional(),
  });

  it("parses valid JSON matching the schema", () => {
    const result = parseToolArgs(schema, '{"path": "/tmp/test.txt"}');
    expect(result).toEqual({ path: "/tmp/test.txt" });
  });

  it("parses with optional fields present", () => {
    const result = parseToolArgs(
      schema,
      '{"path": "/tmp/test.txt", "count": 5}',
    );
    expect(result).toEqual({ path: "/tmp/test.txt", count: 5 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseToolArgs(schema, "not json")).toThrow(SyntaxError);
  });

  it("throws on empty string JSON", () => {
    expect(() => parseToolArgs(schema, "")).toThrow();
  });

  it("throws with message for missing required field", () => {
    expect(() => parseToolArgs(schema, "{}")).toThrow();
  });

  it("throws with message for wrong type", () => {
    expect(() => parseToolArgs(schema, '{"path": 123}')).toThrow();
  });

  it("joins multiple validation errors with semicolons", () => {
    const strictSchema = z.object({
      a: z.string(),
      b: z.number(),
    });
    try {
      parseToolArgs(strictSchema, '{"a": 1, "b": "x"}');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("; ");
    }
  });

  it("throws for negative count when positive is required", () => {
    expect(() => parseToolArgs(schema, '{"path": "x", "count": -1}')).toThrow();
  });
});

describe("toToolDefinition", () => {
  it("maps tool properties to OpenAI format", () => {
    const tool: Tool = {
      name: "read_file",
      description: "Read a file",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
        },
        required: ["path"],
      },
      execute: vi.fn(),
    };

    const def = toToolDefinition(tool);

    expect(def).toEqual({
      type: "function",
      function: {
        name: "read_file",
        description: "Read a file",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string" },
          },
          required: ["path"],
        },
      },
    });
  });

  it("excludes non-API fields like displayName, interactive, enabled", () => {
    const tool: Tool = {
      name: "test_tool",
      displayName: "Test Tool",
      description: "A test",
      parameters: {},
      interactive: true,
      enabled: false,
      warning: () => "misconfigured",
      execute: vi.fn(),
    };

    const def = toToolDefinition(tool);

    expect(def).toEqual({
      type: "function",
      function: {
        name: "test_tool",
        description: "A test",
        parameters: {},
      },
    });
    expect(def).not.toHaveProperty("displayName");
    expect(def).not.toHaveProperty("interactive");
    expect(def).not.toHaveProperty("enabled");
    expect(def).not.toHaveProperty("warning");
  });

  it("preserves nested parameter structure", () => {
    const tool: Tool = {
      name: "complex",
      description: "Complex params",
      parameters: {
        type: "object",
        properties: {
          config: {
            type: "object",
            properties: {
              nested: { type: "string" },
            },
          },
        },
      },
      execute: vi.fn(),
    };

    const def = toToolDefinition(tool);
    expect(def.function.parameters).toEqual(tool.parameters);
  });
});
