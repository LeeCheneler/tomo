import { parse } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import { type MockFsState, mockFs } from "../test-utils/mock-fs";
import { GLOBAL_CONFIG_PATH, LOCAL_CONFIG_PATH, loadConfig } from "./file";
import {
  addProvider,
  removeProvider,
  updateActiveModel,
  updateActiveProvider,
  updateAllowedCommands,
  updatePermissions,
  updateTools,
} from "./updaters";

describe("updateActiveModel", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("sets activeModel in global config", () => {
    state = mockConfig({ global: { activeModel: "old" } });
    updateActiveModel("qwen3:8b");
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.activeModel).toBe("qwen3:8b");
  });

  it("preserves other fields", () => {
    state = mockConfig({
      global: { activeModel: "old", activeProvider: "ollama" },
    });
    updateActiveModel("new");
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.activeProvider).toBe("ollama");
  });
});

describe("updateActiveProvider", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("sets activeProvider in global config", () => {
    state = mockConfig({ global: { activeProvider: "old" } });
    updateActiveProvider("openrouter");
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.activeProvider).toBe("openrouter");
  });
});

describe("addProvider", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("appends a provider to global config", () => {
    state = mockConfig({ global: { providers: [] } });
    addProvider({
      name: "ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
    });
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.providers).toHaveLength(1);
    expect(raw.providers[0].name).toBe("ollama");
  });

  it("handles missing providers array", () => {
    state = mockConfig({ global: {} });
    addProvider({
      name: "ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
    });
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.providers).toHaveLength(1);
  });

  it("appends to existing providers", () => {
    state = mockConfig({
      global: {
        providers: [
          { name: "ollama", type: "ollama", baseUrl: "http://localhost:11434" },
        ],
      },
    });
    addProvider({
      name: "openrouter",
      type: "openrouter",
      baseUrl: "https://openrouter.ai/api",
    });
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.providers).toHaveLength(2);
  });
});

describe("removeProvider", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("removes a provider by name", () => {
    state = mockConfig({
      global: {
        providers: [
          { name: "ollama", type: "ollama", baseUrl: "http://localhost:11434" },
          {
            name: "openrouter",
            type: "openrouter",
            baseUrl: "https://openrouter.ai/api",
          },
        ],
      },
    });
    removeProvider("ollama");
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.providers).toHaveLength(1);
    expect(raw.providers[0].name).toBe("openrouter");
  });

  it("handles missing providers array", () => {
    state = mockConfig({ global: {} });
    removeProvider("ollama");
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.providers).toEqual([]);
  });

  it("no-ops when provider not found", () => {
    state = mockConfig({
      global: {
        providers: [
          { name: "ollama", type: "ollama", baseUrl: "http://localhost:11434" },
        ],
      },
    });
    removeProvider("nonexistent");
    const raw = parse(state.getFile(GLOBAL_CONFIG_PATH)!);
    expect(raw.providers).toHaveLength(1);
  });
});

describe("updatePermissions", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("sets permissions in local config", () => {
    state = mockConfig({ global: {} });
    updatePermissions({ cwdReadFile: true, cwdWriteFile: true });
    const raw = parse(state.getFile(LOCAL_CONFIG_PATH)!);
    expect(raw.permissions.cwdReadFile).toBe(true);
    expect(raw.permissions.cwdWriteFile).toBe(true);
  });
});

describe("updateAllowedCommands", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("sets allowedCommands in local config", () => {
    state = mockConfig({ global: {} });
    updateAllowedCommands(["git:*", "npm test"]);
    const raw = parse(state.getFile(LOCAL_CONFIG_PATH)!);
    expect(raw.allowedCommands).toEqual(["git:*", "npm test"]);
  });
});

describe("updateTools", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("sets tools config in local config", () => {
    state = mockConfig({ global: {} });
    updateTools({
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
    const raw = parse(state.getFile(LOCAL_CONFIG_PATH)!);
    expect(raw.tools.webSearch.enabled).toBe(true);
    expect(raw.tools.webSearch.apiKey).toBe("tvly-123");
  });
});
