import { afterEach, describe, expect, it } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import type { MockFsState } from "../test-utils/mock-fs";
import { loadConfig } from "./file";
import {
  addMcpConnection,
  addProvider,
  addSkillSetSource,
  removeMcpConnection,
  removeProvider,
  removeSkillSetSource,
  updateActiveModel,
  updateActiveProvider,
  updateAllowedCommands,
  updateMcpConnection,
  updatePermissions,
  updateProvider,
  updateSkillSetEnabledSets,
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

describe("addSkillSetSource", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("appends a source to global config", () => {
    state = mockConfig({ global: {} });
    addSkillSetSource({
      url: "git@github.com:org/skills.git",
      enabledSets: [],
    });
    const config = loadConfig();
    expect(config.skillSets.sources).toHaveLength(1);
    expect(config.skillSets.sources[0].url).toBe(
      "git@github.com:org/skills.git",
    );
  });

  it("appends to existing sources", () => {
    state = mockConfig({
      global: {
        skillSets: {
          sources: [{ url: "git@github.com:org/first.git", enabledSets: [] }],
        },
      },
    });
    addSkillSetSource({
      url: "git@github.com:org/second.git",
      enabledSets: [],
    });
    const config = loadConfig();
    expect(config.skillSets.sources).toHaveLength(2);
  });
});

describe("removeSkillSetSource", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("removes a source by URL", () => {
    state = mockConfig({
      global: {
        skillSets: {
          sources: [
            { url: "git@github.com:org/a.git", enabledSets: ["dev"] },
            { url: "git@github.com:org/b.git", enabledSets: [] },
          ],
        },
      },
    });
    removeSkillSetSource("git@github.com:org/a.git");
    const config = loadConfig();
    expect(config.skillSets.sources).toHaveLength(1);
    expect(config.skillSets.sources[0].url).toBe("git@github.com:org/b.git");
  });

  it("no-ops when source not found", () => {
    state = mockConfig({
      global: {
        skillSets: {
          sources: [{ url: "git@github.com:org/a.git", enabledSets: [] }],
        },
      },
    });
    removeSkillSetSource("git@github.com:org/nope.git");
    const config = loadConfig();
    expect(config.skillSets.sources).toHaveLength(1);
  });
});

describe("updateSkillSetEnabledSets", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("updates enabled sets for a source", () => {
    state = mockConfig({
      global: {
        skillSets: {
          sources: [{ url: "git@github.com:org/a.git", enabledSets: [] }],
        },
      },
    });
    updateSkillSetEnabledSets("git@github.com:org/a.git", ["dev", "ops"]);
    const config = loadConfig();
    expect(config.skillSets.sources[0].enabledSets).toEqual(["dev", "ops"]);
  });

  it("preserves other sources", () => {
    state = mockConfig({
      global: {
        skillSets: {
          sources: [
            { url: "git@github.com:org/a.git", enabledSets: [] },
            { url: "git@github.com:org/b.git", enabledSets: ["design"] },
          ],
        },
      },
    });
    updateSkillSetEnabledSets("git@github.com:org/a.git", ["dev"]);
    const config = loadConfig();
    expect(config.skillSets.sources[0].enabledSets).toEqual(["dev"]);
    expect(config.skillSets.sources[1].enabledSets).toEqual(["design"]);
  });
});

describe("addMcpConnection", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("adds a new stdio connection", () => {
    state = mockConfig({ global: { mcp: { connections: {} } } });
    addMcpConnection("my-server", {
      transport: "stdio",
      command: "node",
      args: ["server.mjs"],
      enabled: true,
    });
    const config = loadConfig();
    expect(Object.keys(config.mcp.connections)).toEqual(["my-server"]);
    const conn = config.mcp.connections["my-server"];
    expect(conn.transport).toBe("stdio");
    if (conn.transport === "stdio") {
      expect(conn.command).toBe("node");
      expect(conn.args).toEqual(["server.mjs"]);
    }
  });

  it("adds a new http connection with headers", () => {
    state = mockConfig({ global: {} });
    addMcpConnection("api", {
      transport: "http",
      url: "https://example.com/mcp",
      headers: { Authorization: "Bearer xxx" },
      enabled: true,
    });
    const config = loadConfig();
    const conn = config.mcp.connections.api;
    expect(conn.transport).toBe("http");
    if (conn.transport === "http") {
      expect(conn.url).toBe("https://example.com/mcp");
      expect(conn.headers).toEqual({ Authorization: "Bearer xxx" });
    }
  });

  it("appends without disturbing existing connections", () => {
    state = mockConfig({
      global: {
        mcp: {
          connections: {
            existing: {
              transport: "stdio",
              command: "old",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });
    addMcpConnection("new-one", {
      transport: "stdio",
      command: "new",
      args: [],
      enabled: true,
    });
    const config = loadConfig();
    expect(Object.keys(config.mcp.connections)).toEqual([
      "existing",
      "new-one",
    ]);
  });
});

describe("removeMcpConnection", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("removes a connection by name", () => {
    state = mockConfig({
      global: {
        mcp: {
          connections: {
            a: { transport: "stdio", command: "a", args: [], enabled: true },
            b: { transport: "stdio", command: "b", args: [], enabled: true },
          },
        },
      },
    });
    removeMcpConnection("a");
    const config = loadConfig();
    expect(Object.keys(config.mcp.connections)).toEqual(["b"]);
  });

  it("no-ops when connection not found", () => {
    state = mockConfig({
      global: {
        mcp: {
          connections: {
            a: { transport: "stdio", command: "a", args: [], enabled: true },
          },
        },
      },
    });
    removeMcpConnection("nonexistent");
    const config = loadConfig();
    expect(Object.keys(config.mcp.connections)).toEqual(["a"]);
  });

  it("handles missing mcp section", () => {
    state = mockConfig({ global: {} });
    removeMcpConnection("anything");
    const config = loadConfig();
    expect(config.mcp.connections).toEqual({});
  });
});

describe("updateMcpConnection", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("updates a connection in place when name is unchanged", () => {
    state = mockConfig({
      global: {
        mcp: {
          connections: {
            srv: {
              transport: "stdio",
              command: "old",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });
    updateMcpConnection("srv", "srv", {
      transport: "stdio",
      command: "new",
      args: ["--flag"],
      enabled: true,
    });
    const config = loadConfig();
    const conn = config.mcp.connections.srv;
    if (conn.transport === "stdio") {
      expect(conn.command).toBe("new");
      expect(conn.args).toEqual(["--flag"]);
    }
  });

  it("renames a connection while preserving its position", () => {
    state = mockConfig({
      global: {
        mcp: {
          connections: {
            first: {
              transport: "stdio",
              command: "a",
              args: [],
              enabled: true,
            },
            middle: {
              transport: "stdio",
              command: "b",
              args: [],
              enabled: true,
            },
            last: {
              transport: "stdio",
              command: "c",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });
    updateMcpConnection("middle", "renamed", {
      transport: "stdio",
      command: "b",
      args: [],
      enabled: true,
    });
    const config = loadConfig();
    expect(Object.keys(config.mcp.connections)).toEqual([
      "first",
      "renamed",
      "last",
    ]);
  });

  it("supports rename across transport types", () => {
    state = mockConfig({
      global: {
        mcp: {
          connections: {
            srv: {
              transport: "stdio",
              command: "old",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });
    updateMcpConnection("srv", "srv", {
      transport: "http",
      url: "https://example.com/mcp",
      enabled: true,
    });
    const config = loadConfig();
    expect(config.mcp.connections.srv.transport).toBe("http");
  });
});
