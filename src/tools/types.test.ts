import { describe, expect, it } from "vitest";
import { z } from "zod";
import { denied, err, ok, parseToolArgs } from "./types";

describe("ok", () => {
  it("creates a result with ok status", () => {
    const result = ok("success");
    expect(result).toEqual({ output: "success", status: "ok" });
  });
});

describe("err", () => {
  it("creates a result with error status", () => {
    const result = err("something broke");
    expect(result).toEqual({ output: "something broke", status: "error" });
  });
});

describe("denied", () => {
  it("creates a result with denied status", () => {
    const result = denied("user said no");
    expect(result).toEqual({ output: "user said no", status: "denied" });
  });
});

describe("parseToolArgs", () => {
  const schema = z.object({
    path: z.string().min(1),
    startLine: z.number().optional(),
  });

  it("parses valid JSON args against schema", () => {
    const result = parseToolArgs(schema, '{"path": "/foo.ts"}');
    expect(result).toEqual({ path: "/foo.ts" });
  });

  it("includes optional fields when present", () => {
    const result = parseToolArgs(
      schema,
      '{"path": "/foo.ts", "startLine": 10}',
    );
    expect(result).toEqual({ path: "/foo.ts", startLine: 10 });
  });

  it("throws on invalid JSON", () => {
    expect(() => parseToolArgs(schema, "not json")).toThrow();
  });

  it("throws on validation failure", () => {
    expect(() => parseToolArgs(schema, '{"path": ""}')).toThrow();
  });

  it("throws with joined messages on multiple failures", () => {
    const multi = z.object({
      a: z.string().min(1, "a required"),
      b: z.number({ message: "b must be number" }),
    });
    const thrownError = (() => {
      try {
        parseToolArgs(multi, '{"a": "", "b": "x"}');
      } catch (e) {
        return e as Error;
      }
      return null;
    })();
    expect(thrownError).toBeTruthy();
    expect(thrownError?.message).toContain("a required");
    expect(thrownError?.message).toContain(";");
  });
});
