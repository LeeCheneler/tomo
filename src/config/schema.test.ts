import { describe, expect, it } from "vitest";
import { configSchema, providerSchema } from "./schema";

describe("providerSchema", () => {
  it("parses a valid provider", () => {
    const result = providerSchema.parse({
      name: "ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
    });
    expect(result.name).toBe("ollama");
    expect(result.type).toBe("ollama");
    expect(result.baseUrl).toBe("http://localhost:11434");
    expect(result.apiKey).toBeUndefined();
  });

  it("parses a provider with apiKey", () => {
    const result = providerSchema.parse({
      name: "openrouter",
      type: "openrouter",
      baseUrl: "https://openrouter.ai/api",
      apiKey: "sk-or-123",
    });
    expect(result.apiKey).toBe("sk-or-123");
  });

  it("rejects an empty name", () => {
    expect(() =>
      providerSchema.parse({
        name: "",
        type: "ollama",
        baseUrl: "http://localhost:11434",
      }),
    ).toThrow();
  });

  it("rejects an invalid type", () => {
    expect(() =>
      providerSchema.parse({
        name: "foo",
        type: "invalid",
        baseUrl: "http://localhost:11434",
      }),
    ).toThrow();
  });

  it("rejects an invalid baseUrl", () => {
    expect(() =>
      providerSchema.parse({
        name: "foo",
        type: "ollama",
        baseUrl: "not-a-url",
      }),
    ).toThrow();
  });
});

describe("configSchema", () => {
  it("parses with all fields present", () => {
    const result = configSchema.parse({
      activeModel: "qwen3:8b",
      activeProvider: "ollama",
      providers: [
        {
          name: "ollama",
          type: "ollama",
          baseUrl: "http://localhost:11434",
        },
      ],
    });
    expect(result.activeModel).toBe("qwen3:8b");
    expect(result.activeProvider).toBe("ollama");
    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].name).toBe("ollama");
  });

  it("parses with null fields", () => {
    const result = configSchema.parse({
      activeModel: null,
      activeProvider: null,
    });
    expect(result.activeModel).toBeNull();
    expect(result.activeProvider).toBeNull();
  });

  it("defaults providers to empty array", () => {
    const result = configSchema.parse({});
    expect(result.providers).toEqual([]);
  });

  it("defaults missing fields to undefined", () => {
    const result = configSchema.parse({});
    expect(result.activeModel).toBeUndefined();
    expect(result.activeProvider).toBeUndefined();
  });

  it("defaults permissions with cwdReadFile allowed", () => {
    const result = configSchema.parse({});
    expect(result.permissions.cwdReadFile).toBe(true);
    expect(result.permissions.cwdWriteFile).toBeUndefined();
    expect(result.permissions.globalReadFile).toBeUndefined();
    expect(result.permissions.globalWriteFile).toBeUndefined();
  });

  it("parses explicit permissions", () => {
    const result = configSchema.parse({
      permissions: {
        cwdReadFile: false,
        cwdWriteFile: true,
        globalReadFile: true,
        globalWriteFile: false,
      },
    });
    expect(result.permissions.cwdReadFile).toBe(false);
    expect(result.permissions.cwdWriteFile).toBe(true);
    expect(result.permissions.globalReadFile).toBe(true);
    expect(result.permissions.globalWriteFile).toBe(false);
  });
});
