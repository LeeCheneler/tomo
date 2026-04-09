import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import { type MockFsState, mockFs } from "../test-utils/mock-fs";
import {
  GLOBAL_CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  loadConfig,
  saveGlobalConfig,
  saveLocalConfig,
  updateGlobalConfig,
  updateLocalConfig,
} from "./file";

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

describe("saveGlobalConfig", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("writes config to global config path as YAML", () => {
    state = mockConfig();
    saveGlobalConfig({ activeModel: "qwen3:8b" });
    const written = state.getFile(GLOBAL_CONFIG_PATH);
    expect(written).toBeDefined();
    expect(written).toContain("activeModel: qwen3:8b");
  });

  it("overwrites existing global config", () => {
    state = mockConfig({ global: { activeModel: "old" } });
    saveGlobalConfig({ activeModel: "new" });
    const written = state.getFile(GLOBAL_CONFIG_PATH);
    expect(written).toContain("activeModel: new");
    expect(written).not.toContain("activeModel: old");
  });

  it("round-trips through loadConfig", () => {
    state = mockConfig();
    saveGlobalConfig({
      activeModel: "qwen3:8b",
      activeProvider: "ollama",
      providers: [
        { name: "ollama", type: "ollama", baseUrl: "http://localhost:11434" },
      ],
    });
    const config = loadConfig();
    expect(config.activeModel).toBe("qwen3:8b");
    expect(config.providers).toHaveLength(1);
  });
});

describe("saveLocalConfig", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("writes config to local config path as YAML", () => {
    state = mockConfig({ global: {} });
    saveLocalConfig({ activeModel: "llama3:70b" });
    const written = state.getFile(LOCAL_CONFIG_PATH);
    expect(written).toBeDefined();
    expect(written).toContain("activeModel: llama3:70b");
  });

  it("local save overrides global on next load", () => {
    state = mockConfig({ global: { activeModel: "qwen3:8b" } });
    saveLocalConfig({ activeModel: "llama3:70b" });
    const config = loadConfig();
    expect(config.activeModel).toBe("llama3:70b");
  });
});

describe("updateGlobalConfig", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("reads existing config, applies updater, and writes back", () => {
    state = mockConfig({
      global: { activeModel: "old", activeProvider: "ollama" },
    });
    updateGlobalConfig((raw) => ({ ...raw, activeModel: "new" }));
    const config = loadConfig();
    expect(config.activeModel).toBe("new");
    expect(config.activeProvider).toBe("ollama");
  });

  it("creates file if it does not exist", () => {
    state = mockConfig();
    updateGlobalConfig((raw) => ({ ...raw, activeModel: "qwen3:8b" }));
    expect(state.getFile(GLOBAL_CONFIG_PATH)).toContain(
      "activeModel: qwen3:8b",
    );
  });
});

describe("updateLocalConfig", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("reads existing config, applies updater, and writes back", () => {
    state = mockConfig({
      global: {},
      local: { allowedCommands: ["git:*"] },
    });
    updateLocalConfig((raw) => ({
      ...raw,
      allowedCommands: [...(raw.allowedCommands as string[]), "npm test"],
    }));
    const written = state.getFile(LOCAL_CONFIG_PATH);
    expect(written).toContain("git:*");
    expect(written).toContain("npm test");
  });

  it("creates file if it does not exist", () => {
    state = mockConfig({ global: {} });
    updateLocalConfig((raw) => ({ ...raw, activeModel: "llama3:70b" }));
    expect(state.getFile(LOCAL_CONFIG_PATH)).toContain(
      "activeModel: llama3:70b",
    );
  });
});
