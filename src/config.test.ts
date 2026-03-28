import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parse } from "yaml";
import {
  addAllowedCommand,
  addMcpServer,
  addProvider,
  type Config,
  getActiveProvider,
  getAllMcpServers,
  getAllowedCommands,
  getMcpServers,
  loadConfig,
  removeMcpServer,
  removeProvider,
  updateActiveModel,
  updateMcpServerEnabled,
  updateMcpServerTools,
} from "./config";

const tmpDir = resolve(import.meta.dirname, "../.test-config-tmp");
const globalDir = resolve(tmpDir, "global/.tomo");
const localDir = resolve(tmpDir, "local/.tomo");
const globalPath = resolve(globalDir, "config.yaml");
const localPath = resolve(localDir, "config.yaml");

function writeYaml(path: string, content: string) {
  const dir = resolve(path, "..");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, content, "utf-8");
}

vi.mock("node:os", () => ({
  homedir: () => resolve(tmpDir, "global"),
}));

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(resolve(tmpDir, "local"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("loadConfig", () => {
  it("creates default config when none exists", () => {
    const config = loadConfig();
    expect(config.activeProvider).toBe("");
    expect(config.activeModel).toBe("");
    expect(config.providers).toHaveLength(0);
    expect(existsSync(globalPath)).toBe(true);
  });

  it("loads global config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: my-ollama
activeModel: llama3
providers:
  - name: my-ollama
    type: ollama
    baseUrl: http://localhost:9999
`,
    );
    const config = loadConfig();
    expect(config.activeProvider).toBe("my-ollama");
    expect(config.activeModel).toBe("llama3");
    expect(config.providers[0].baseUrl).toBe("http://localhost:9999");
  });

  it("merges local config on top of global", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
`,
    );
    writeYaml(
      localPath,
      `
activeProvider: local-ollama
activeModel: mistral
providers:
  - name: local-ollama
    type: ollama
    baseUrl: http://localhost:5555
`,
    );
    const config = loadConfig();
    expect(config.activeProvider).toBe("local-ollama");
    expect(config.activeModel).toBe("mistral");
  });

  it("accepts empty providers array", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers: []
`,
    );
    const config = loadConfig();
    expect(config.providers).toHaveLength(0);
  });

  it("throws on missing provider name", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - type: ollama
    baseUrl: http://localhost:11434
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("throws on unsupported provider type", () => {
    writeYaml(
      globalPath,
      `
activeProvider: test
activeModel: qwen3:8b
providers:
  - name: test
    type: unsupported
    baseUrl: http://localhost:11434
`,
    );
    expect(() => loadConfig()).toThrow("unsupported provider type");
  });

  it("throws on missing baseUrl", () => {
    writeYaml(
      globalPath,
      `
activeProvider: test
activeModel: qwen3:8b
providers:
  - name: test
    type: ollama
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("loads when activeProvider does not match any provider", () => {
    writeYaml(
      globalPath,
      `
activeProvider: nonexistent
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
`,
    );
    const config = loadConfig();
    expect(config.activeProvider).toBe("nonexistent");
    expect(config.providers).toHaveLength(1);
  });
});

describe("getActiveProvider", () => {
  it("returns the active provider", () => {
    const config: Config = {
      activeProvider: "ollama",
      activeModel: "qwen3:8b",
      maxTokens: 8192,
      providers: [
        {
          name: "ollama",
          type: "ollama",
          baseUrl: "http://localhost:11434",
        },
      ],
    };
    const provider = getActiveProvider(config);
    expect(provider.name).toBe("ollama");
    expect(provider.baseUrl).toBe("http://localhost:11434");
  });

  it("throws when active provider not found", () => {
    const config: Config = {
      activeProvider: "missing",
      activeModel: "qwen3:8b",
      maxTokens: 8192,
      providers: [
        {
          name: "ollama",
          type: "ollama",
          baseUrl: "http://localhost:11434",
        },
      ],
    };
    expect(() => getActiveProvider(config)).toThrow(
      'active provider "missing" not found',
    );
  });
});

describe("loadConfig with apiKey", () => {
  it("accepts optional apiKey on provider", () => {
    writeYaml(
      globalPath,
      `
activeProvider: openrouter
activeModel: gpt-4o
providers:
  - name: openrouter
    type: openrouter
    baseUrl: https://api.openai.com
    apiKey: sk-test-123
`,
    );
    const config = loadConfig();
    expect(config.providers[0].apiKey).toBe("sk-test-123");
  });

  it("loads without apiKey (optional)", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
`,
    );
    const config = loadConfig();
    expect(config.providers[0].apiKey).toBeUndefined();
  });
});

describe("addProvider", () => {
  it("adds a provider to the global config", () => {
    loadConfig(); // create default
    addProvider({
      name: "openrouter",
      type: "openrouter",
      baseUrl: "https://api.openai.com",
      apiKey: "sk-test",
    });
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].name).toBe("openrouter");
    expect(config.providers[0].apiKey).toBe("sk-test");
  });
});

describe("removeProvider", () => {
  it("removes a provider from the global config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
  - name: openrouter
    type: openrouter
    baseUrl: https://api.openai.com
`,
    );
    removeProvider("openrouter");
    const config = loadConfig();
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].name).toBe("ollama");
  });

  it("is a no-op when provider name not found", () => {
    loadConfig(); // create default
    removeProvider("nonexistent");
    const config = loadConfig();
    expect(config.providers).toHaveLength(0);
  });
});

describe("updateActiveModel", () => {
  it("updates activeModel in the global config", () => {
    loadConfig(); // create default global config
    updateActiveModel("llama3:70b");
    const config = loadConfig();
    expect(config.activeModel).toBe("llama3:70b");
  });

  it("does not modify local config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
`,
    );
    writeYaml(
      localPath,
      `
activeModel: original-model
`,
    );
    updateActiveModel("mistral");
    // Local config should still override to original-model since we
    // only wrote to global. loadConfig merges local on top.
    const config = loadConfig();
    expect(config.activeModel).toBe("original-model");
  });
});

describe("getAllowedCommands", () => {
  it("returns empty array when no allowed commands in config", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
    };
    expect(getAllowedCommands(config)).toEqual([]);
  });

  it("returns allowed commands from config", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      allowed_commands: ["npm test", "git status"],
    };
    expect(getAllowedCommands(config)).toEqual(["npm test", "git status"]);
  });
});

describe("addAllowedCommand", () => {
  it("adds a command to local config", () => {
    loadConfig(); // create default global
    addAllowedCommand("npm test");
    const raw = parse(readFileSync(localPath, "utf-8"));
    expect(raw.allowed_commands).toEqual(["npm test"]);
  });

  it("deduplicates commands", () => {
    loadConfig();
    addAllowedCommand("npm test");
    addAllowedCommand("npm test");
    const raw = parse(readFileSync(localPath, "utf-8"));
    expect(raw.allowed_commands).toEqual(["npm test"]);
  });

  it("appends to existing allowed commands", () => {
    loadConfig();
    writeYaml(
      localPath,
      `
allowed_commands:
  - git status
`,
    );
    addAllowedCommand("npm test");
    const raw = parse(readFileSync(localPath, "utf-8"));
    expect(raw.allowed_commands).toEqual(["git status", "npm test"]);
  });
});

describe("loadConfig with allowed_commands", () => {
  it("loads allowed_commands from config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
allowed_commands:
  - npm test
  - git status
`,
    );
    const config = loadConfig();
    expect(config.allowed_commands).toEqual(["npm test", "git status"]);
  });
});

describe("loadConfig with mcpServers", () => {
  it("loads stdio MCP server config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  filesystem:
    transport: stdio
    command: npx
    args:
      - "-y"
      - "@modelcontextprotocol/server-filesystem"
      - "/tmp"
`,
    );
    const config = loadConfig();
    const fs = config.mcpServers?.filesystem;
    expect(fs).toBeDefined();
    expect(fs?.transport).toBe("stdio");
    if (fs?.transport === "stdio") {
      expect(fs.command).toBe("npx");
      expect(fs.args).toEqual([
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/tmp",
      ]);
    }
  });

  it("loads http MCP server config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  remote:
    transport: http
    url: https://mcp.example.com/sse
    headers:
      Authorization:
        value: "Bearer token123"
`,
    );
    const config = loadConfig();
    const remote = config.mcpServers?.remote;
    expect(remote).toBeDefined();
    expect(remote?.transport).toBe("http");
    if (remote?.transport === "http") {
      expect(remote.url).toBe("https://mcp.example.com/sse");
      expect(remote.headers).toEqual({
        Authorization: { value: "Bearer token123" },
      });
    }
  });

  it("loads multiple MCP servers", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  filesystem:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
  remote:
    transport: http
    url: https://mcp.example.com/sse
`,
    );
    const config = loadConfig();
    expect(Object.keys(config.mcpServers ?? {})).toEqual([
      "filesystem",
      "remote",
    ]);
  });

  it("defaults args to empty array for stdio server", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  simple:
    transport: stdio
    command: my-server
`,
    );
    const config = loadConfig();
    const server = config.mcpServers?.simple;
    expect(server).toBeDefined();
    if (server?.transport === "stdio") {
      expect(server.args).toEqual([]);
    }
  });

  it("loads stdio server with env vars", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  postgres:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-postgres"]
    env:
      POSTGRES_URL:
        value: "postgresql://localhost:5432/mydb"
`,
    );
    const config = loadConfig();
    const server = config.mcpServers?.postgres;
    expect(server).toBeDefined();
    if (server?.transport === "stdio") {
      expect(server.env).toEqual({
        POSTGRES_URL: { value: "postgresql://localhost:5432/mydb" },
      });
    }
  });

  it("throws on missing transport field", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  broken:
    command: npx
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("throws on invalid transport type", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  broken:
    transport: websocket
    url: ws://localhost:8080
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("throws on stdio server with missing command", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  broken:
    transport: stdio
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("throws on http server with missing url", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  broken:
    transport: http
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("throws on http server with invalid url", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  broken:
    transport: http
    url: not-a-url
`,
    );
    expect(() => loadConfig()).toThrow("validation failed");
  });

  it("merges local mcpServers on top of global", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  filesystem:
    transport: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem"]
`,
    );
    writeYaml(
      localPath,
      `
mcpServers:
  local-server:
    transport: stdio
    command: my-local-server
`,
    );
    const config = loadConfig();
    // Local mcpServers replaces global (shallow merge)
    expect(config.mcpServers?.["local-server"]).toBeDefined();
    expect(config.mcpServers?.filesystem).toBeUndefined();
  });

  it("loads config without mcpServers (optional)", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
`,
    );
    const config = loadConfig();
    expect(config.mcpServers).toBeUndefined();
  });
});

describe("getMcpServers", () => {
  it("returns empty record when no mcpServers configured", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
    };
    expect(getMcpServers(config)).toEqual({});
  });

  it("returns servers as-is when no env vars present", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        fs: {
          transport: "stdio" as const,
          command: "npx",
          args: ["-y", "server-fs"],
        },
      },
    };
    const servers = getMcpServers(config);
    expect(servers.fs.transport).toBe("stdio");
    if (servers.fs.transport === "stdio") {
      expect(servers.fs.command).toBe("npx");
    }
  });

  it("substitutes env vars in string values", () => {
    process.env.TEST_MCP_TOKEN = "secret-token-123";
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        remote: {
          transport: "http" as const,
          url: "https://mcp.example.com/sse",
          headers: {
            Authorization: { value: "Bearer $" + "{TEST_MCP_TOKEN}" },
          },
        },
      },
    };
    const servers = getMcpServers(config);
    if (servers.remote.transport === "http") {
      expect(
        (servers.remote.headers?.Authorization as { value: string }).value,
      ).toBe("Bearer secret-token-123");
    }
    delete process.env.TEST_MCP_TOKEN;
  });

  it("substitutes env vars in stdio env field", () => {
    process.env.TEST_PG_URL = "postgresql://localhost:5432/db";
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        pg: {
          transport: "stdio" as const,
          command: "npx",
          args: [],
          env: {
            POSTGRES_URL: { value: "$" + "{TEST_PG_URL}" },
          },
        },
      },
    };
    const servers = getMcpServers(config);
    if (servers.pg.transport === "stdio") {
      expect((servers.pg.env?.POSTGRES_URL as { value: string }).value).toBe(
        "postgresql://localhost:5432/db",
      );
    }
    delete process.env.TEST_PG_URL;
  });

  it("replaces missing env vars with empty string", () => {
    delete process.env.NONEXISTENT_VAR;
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        remote: {
          transport: "http" as const,
          url: "https://mcp.example.com/sse",
          headers: {
            Authorization: { value: "Bearer $" + "{NONEXISTENT_VAR}" },
          },
        },
      },
    };
    const servers = getMcpServers(config);
    if (servers.remote.transport === "http") {
      expect(
        (servers.remote.headers?.Authorization as { value: string }).value,
      ).toBe("Bearer ");
    }
  });

  it("substitutes env vars in args array", () => {
    process.env.TEST_MCP_PATH = "/home/user/data";
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        fs: {
          transport: "stdio" as const,
          command: "npx",
          args: ["-y", "server-fs", "$" + "{TEST_MCP_PATH}"],
        },
      },
    };
    const servers = getMcpServers(config);
    if (servers.fs.transport === "stdio") {
      expect(servers.fs.args).toEqual(["-y", "server-fs", "/home/user/data"]);
    }
    delete process.env.TEST_MCP_PATH;
  });

  it("filters out disabled servers", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        enabled: {
          transport: "stdio" as const,
          command: "cmd1",
          args: [],
        },
        disabled: {
          transport: "stdio" as const,
          command: "cmd2",
          args: [],
          enabled: false,
        },
      },
    };
    const servers = getMcpServers(config);
    expect(Object.keys(servers)).toEqual(["enabled"]);
  });
});

describe("getAllMcpServers", () => {
  it("returns all servers including disabled", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
      mcpServers: {
        enabled: {
          transport: "stdio" as const,
          command: "cmd1",
          args: [],
        },
        disabled: {
          transport: "stdio" as const,
          command: "cmd2",
          args: [],
          enabled: false,
        },
      },
    };
    const servers = getAllMcpServers(config);
    expect(Object.keys(servers)).toEqual(["enabled", "disabled"]);
  });

  it("returns empty record when no servers configured", () => {
    const config: Config = {
      activeProvider: "",
      activeModel: "",
      maxTokens: 8192,
      providers: [],
    };
    expect(getAllMcpServers(config)).toEqual({});
  });
});

describe("addMcpServer", () => {
  it("adds a server to the global config", () => {
    loadConfig(); // create default
    addMcpServer("test-server", {
      transport: "http",
      url: "https://mcp.example.com",
    });
    const config = loadConfig();
    expect(config.mcpServers?.["test-server"]).toBeDefined();
    expect(config.mcpServers?.["test-server"]?.transport).toBe("http");
  });
});

describe("removeMcpServer", () => {
  it("removes a server from the global config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  server1:
    transport: stdio
    command: cmd1
  server2:
    transport: stdio
    command: cmd2
`,
    );
    removeMcpServer("server1");
    const config = loadConfig();
    expect(config.mcpServers?.server1).toBeUndefined();
    expect(config.mcpServers?.server2).toBeDefined();
  });
});

describe("updateMcpServerEnabled", () => {
  it("sets enabled to false", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  server1:
    transport: stdio
    command: cmd1
`,
    );
    updateMcpServerEnabled("server1", false);
    const config = loadConfig();
    expect(config.mcpServers?.server1?.enabled).toBe(false);
  });

  it("sets enabled to true", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  server1:
    transport: stdio
    command: cmd1
    enabled: false
`,
    );
    updateMcpServerEnabled("server1", true);
    const config = loadConfig();
    expect(config.mcpServers?.server1?.enabled).toBe(true);
  });

  it("is a no-op for unknown servers", () => {
    loadConfig(); // create default
    updateMcpServerEnabled("nonexistent", false);
    const config = loadConfig();
    expect(config.mcpServers).toBeUndefined();
  });
});

describe("MCP server tools config", () => {
  it("loads tools array from server config", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  my-server:
    transport: stdio
    command: my-cmd
    tools:
      - name: tool_a
        enabled: true
      - name: tool_b
        enabled: false
`,
    );
    const config = loadConfig();
    const server = config.mcpServers?.["my-server"];
    expect(server?.tools).toHaveLength(2);
    expect(server?.tools?.[0]).toEqual({ name: "tool_a", enabled: true });
    expect(server?.tools?.[1]).toEqual({ name: "tool_b", enabled: false });
  });

  it("defaults tools to undefined when not set", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  my-server:
    transport: stdio
    command: my-cmd
`,
    );
    const config = loadConfig();
    expect(config.mcpServers?.["my-server"]?.tools).toBeUndefined();
  });
});

describe("updateMcpServerTools", () => {
  it("sets tools array on a server", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  my-server:
    transport: stdio
    command: my-cmd
`,
    );
    updateMcpServerTools("my-server", [
      { name: "tool_a", enabled: true },
      { name: "tool_b", enabled: false },
    ]);
    const config = loadConfig();
    expect(config.mcpServers?.["my-server"]?.tools).toEqual([
      { name: "tool_a", enabled: true },
      { name: "tool_b", enabled: false },
    ]);
  });

  it("overwrites existing tools array", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
mcpServers:
  my-server:
    transport: stdio
    command: my-cmd
    tools:
      - name: old_tool
        enabled: true
`,
    );
    updateMcpServerTools("my-server", [{ name: "new_tool", enabled: false }]);
    const config = loadConfig();
    expect(config.mcpServers?.["my-server"]?.tools).toEqual([
      { name: "new_tool", enabled: false },
    ]);
  });

  it("is a no-op for unknown servers", () => {
    loadConfig();
    updateMcpServerTools("nonexistent", [{ name: "tool", enabled: true }]);
    const config = loadConfig();
    expect(config.mcpServers).toBeUndefined();
  });
});
