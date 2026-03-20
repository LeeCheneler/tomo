import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type Config,
  getActiveProvider,
  loadConfig,
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
    expect(config.activeProvider).toBe("ollama");
    expect(config.activeModel).toBe("qwen3:8b");
    expect(config.providers).toHaveLength(1);
    expect(config.providers[0].name).toBe("ollama");
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

  it("throws on empty providers", () => {
    writeYaml(
      globalPath,
      `
activeProvider: ollama
activeModel: qwen3:8b
providers: []
`,
    );
    expect(() => loadConfig()).toThrow("non-empty");
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

  it("throws when activeProvider does not match any provider", () => {
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
    expect(() => loadConfig()).toThrow(
      'activeProvider "nonexistent" does not match any provider',
    );
  });
});

describe("getActiveProvider", () => {
  it("returns the active provider", () => {
    const config: Config = {
      activeProvider: "ollama",
      activeModel: "qwen3:8b",
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

describe("updateActiveModel", () => {
  it("updates activeModel in the global config", () => {
    loadConfig(); // create default global config
    updateActiveModel("llama3:70b");
    const config = loadConfig();
    expect(config.activeModel).toBe("llama3:70b");
  });

  it("updates activeModel in local config when present", () => {
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
activeProvider: ollama
activeModel: qwen3:8b
providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
`,
    );
    updateActiveModel("mistral");
    const config = loadConfig();
    expect(config.activeModel).toBe("mistral");
  });
});
