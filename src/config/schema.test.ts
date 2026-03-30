import { describe, expect, it } from "vitest";
import { configSchema } from "./schema";

describe("configSchema", () => {
  it("parses with all fields present", () => {
    const result = configSchema.parse({
      activeModel: "qwen3:8b",
      activeProvider: "ollama",
    });
    expect(result.activeModel).toBe("qwen3:8b");
    expect(result.activeProvider).toBe("ollama");
  });

  it("parses with null fields", () => {
    const result = configSchema.parse({
      activeModel: null,
      activeProvider: null,
    });
    expect(result.activeModel).toBeNull();
    expect(result.activeProvider).toBeNull();
  });

  it("defaults missing fields to undefined", () => {
    const result = configSchema.parse({});
    expect(result.activeModel).toBeUndefined();
    expect(result.activeProvider).toBeUndefined();
  });
});
