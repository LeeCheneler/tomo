import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Config,
  addProvider,
  getActiveProvider,
  loadConfig,
  removeProvider,
  updateActiveModel,
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
