import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import { type MockFsState, mockFs } from "../test-utils/mock-fs";
import { GLOBAL_CONFIG_PATH, loadConfig } from "./file";

describe("loadConfig", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("creates default global config and returns defaults on first run", () => {
    state = mockConfig();
    const config = loadConfig();
    expect(config.activeModel).toBeNull();
    expect(config.activeProvider).toBeNull();
    expect(config.providers).toEqual([]);
    expect(state.getFile(GLOBAL_CONFIG_PATH)).toBeDefined();
  });

  it("loads global config", () => {
    state = mockConfig({
      global: {
        activeModel: "qwen3:8b",
        activeProvider: "ollama",
        providers: [
          {
            name: "ollama",
            type: "ollama",
            baseUrl: "http://localhost:11434",
          },
        ],
      },
    });
    const config = loadConfig();
    expect(config.activeModel).toBe("qwen3:8b");
    expect(config.activeProvider).toBe("ollama");
    expect(config.providers).toHaveLength(1);
  });

  it("merges local config on top of global", () => {
    state = mockConfig({
      global: { activeModel: "qwen3:8b" },
      local: { activeModel: "llama3:70b" },
    });
    const config = loadConfig();
    expect(config.activeModel).toBe("llama3:70b");
  });

  it("applies schema defaults for missing fields", () => {
    state = mockConfig({ global: {} });
    const config = loadConfig();
    expect(config.permissions.cwdReadFile).toBe(true);
    expect(config.tools.readFile.enabled).toBe(true);
    expect(config.tools.webSearch.enabled).toBe(false);
  });

  it("handles empty YAML file gracefully", () => {
    state = mockFs({ [GLOBAL_CONFIG_PATH]: "" });
    const config = loadConfig();
    // Empty YAML parses to null, spread as {}, schema defaults activeModel to undefined
    expect(config.providers).toEqual([]);
  });

  it("throws on invalid config", () => {
    state = mockConfig({
      global: {
        providers: [
          { name: "", type: "invalid" as "ollama", baseUrl: "not-a-url" },
        ],
      },
    });
    expect(() => loadConfig()).toThrow("Config validation failed");
  });
});
