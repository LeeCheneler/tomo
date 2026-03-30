import { describe, expect, it } from "vitest";
import {
  configSchema,
  permissionsSchema,
  providerSchema,
  toolsSchema,
} from "./schema";

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

describe("permissionsSchema", () => {
  it("defaults cwdReadFile to true", () => {
    const result = permissionsSchema.parse({});
    expect(result.cwdReadFile).toBe(true);
    expect(result.cwdWriteFile).toBeUndefined();
    expect(result.globalReadFile).toBeUndefined();
    expect(result.globalWriteFile).toBeUndefined();
  });

  it("parses explicit values", () => {
    const result = permissionsSchema.parse({
      cwdReadFile: false,
      cwdWriteFile: true,
      globalReadFile: true,
      globalWriteFile: false,
    });
    expect(result.cwdReadFile).toBe(false);
    expect(result.cwdWriteFile).toBe(true);
    expect(result.globalReadFile).toBe(true);
    expect(result.globalWriteFile).toBe(false);
  });
});

describe("toolsSchema", () => {
  it("parses all tool config entries", () => {
    const result = toolsSchema.parse({
      agent: { enabled: true },
      ask: { enabled: true },
      editFile: { enabled: true },
      glob: { enabled: true },
      grep: { enabled: true },
      readFile: { enabled: true },
      runCommand: { enabled: true },
      skill: { enabled: true },
      webSearch: { enabled: false },
      writeFile: { enabled: true },
    });
    expect(result.webSearch.enabled).toBe(false);
    expect(result.agent.enabled).toBe(true);
  });

  it("parses webSearch with apiKey", () => {
    const result = toolsSchema.parse({
      agent: { enabled: true },
      ask: { enabled: true },
      editFile: { enabled: true },
      glob: { enabled: true },
      grep: { enabled: true },
      readFile: { enabled: true },
      runCommand: { enabled: true },
      skill: { enabled: true },
      webSearch: { enabled: true, apiKey: "tvly-123" },
      writeFile: { enabled: true },
    });
    expect(result.webSearch.apiKey).toBe("tvly-123");
  });

  it("defaults webSearch apiKey to undefined", () => {
    const result = configSchema.parse({});
    expect(result.tools.webSearch.apiKey).toBeUndefined();
  });

  it("rejects missing tools", () => {
    expect(() => toolsSchema.parse({})).toThrow();
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

  it("defaults permissions with cwdReadFile allowed", () => {
    const result = configSchema.parse({});
    expect(result.permissions.cwdReadFile).toBe(true);
  });

  it("defaults allowedCommands to empty array", () => {
    const result = configSchema.parse({});
    expect(result.allowedCommands).toEqual([]);
  });

  it("parses allowedCommands", () => {
    const result = configSchema.parse({
      allowedCommands: ["git:*", "npm test"],
    });
    expect(result.allowedCommands).toEqual(["git:*", "npm test"]);
  });

  it("defaults agents with sensible values", () => {
    const result = configSchema.parse({});
    expect(result.agents.maxDepth).toBe(1);
    expect(result.agents.maxConcurrent).toBe(3);
    expect(result.agents.maxTimeoutSeconds).toBe(300);
    expect(result.agents.tools).toEqual([
      "readFile",
      "glob",
      "grep",
      "webSearch",
      "skill",
    ]);
  });

  it("parses custom agents config", () => {
    const result = configSchema.parse({
      agents: { maxDepth: 2, maxConcurrent: 5, maxTimeoutSeconds: 600 },
    });
    expect(result.agents.maxDepth).toBe(2);
    expect(result.agents.maxConcurrent).toBe(5);
    expect(result.agents.maxTimeoutSeconds).toBe(600);
  });

  it("defaults tools with webSearch disabled", () => {
    const result = configSchema.parse({});
    expect(result.tools.webSearch.enabled).toBe(false);
    expect(result.tools.readFile.enabled).toBe(true);
  });

  it("defaults missing fields to undefined", () => {
    const result = configSchema.parse({});
    expect(result.activeModel).toBeUndefined();
    expect(result.activeProvider).toBeUndefined();
  });
});
