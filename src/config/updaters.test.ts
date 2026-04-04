import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import type { MockFsState } from "../test-utils/mock-fs";
import { loadConfig } from "./file";
import {
  addProvider,
  removeProvider,
  updateActiveModel,
  updateActiveProvider,
  updateAllowedCommands,
  updatePermissions,
  updateProvider,
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
    const config = loadConfig();
    expect(config.activeModel).toBe("qwen3:8b");
  });

  it("preserves other fields", () => {
    state = mockConfig({
      global: { activeModel: "old", activeProvider: "ollama" },
    });
    updateActiveModel("new");
    const config = loadConfig();
    expect(config.activeProvider).toBe("ollama");
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
    const config = loadConfig();
    expect(config.activeProvider).toBe("openrouter");
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
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].name).toBe("ollama");
  });

  it("handles missing providers array", () => {
    state = mockConfig({ global: {} });
    addProvider({
      name: "ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
    });
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
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
    const config = loadConfig();
    expect(config.providers).toHaveLength(2);
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
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].name).toBe("openrouter");
  });

  it("handles missing providers array", () => {
    state = mockConfig({ global: {} });
    removeProvider("ollama");
    const config = loadConfig();
    expect(config.providers).toEqual([]);
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
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
  });
});

describe("updateProvider", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("updates a provider by original name", () => {
    state = mockConfig({
      global: {
        providers: [
          { name: "ollama", type: "ollama", baseUrl: "http://localhost:11434" },
        ],
      },
    });
    updateProvider("ollama", {
      name: "my-ollama",
      type: "ollama",
      baseUrl: "http://localhost:11434",
      apiKey: "sk-123",
    });
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].name).toBe("my-ollama");
    expect(config.providers[0].apiKey).toBe("sk-123");
  });

  it("preserves other providers", () => {
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
    updateProvider("ollama", {
      name: "ollama",
      type: "ollama",
      baseUrl: "http://other:11434",
    });
    const config = loadConfig();
    expect(config.providers).toHaveLength(2);
    expect(config.providers[0].baseUrl).toBe("http://other:11434");
    expect(config.providers[1].name).toBe("openrouter");
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
    const config = loadConfig();
    expect(config.permissions.cwdReadFile).toBe(true);
    expect(config.permissions.cwdWriteFile).toBe(true);
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
    const config = loadConfig();
    expect(config.allowedCommands).toEqual(["git:*", "npm test"]);
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
    const config = loadConfig();
    expect(config.tools.webSearch.enabled).toBe(true);
    expect(config.tools.webSearch.apiKey).toBe("tvly-123");
  });
});
