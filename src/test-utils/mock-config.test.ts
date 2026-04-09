import { parse } from "yaml";
import { afterEach, describe, expect, it } from "vitest";
import { fileExists, readFile } from "../utils/fs";
import { GLOBAL_CONFIG_PATH, LOCAL_CONFIG_PATH } from "../config/file";
import { mockConfig } from "./mock-config";

describe("mockConfig", () => {
  let state: ReturnType<typeof mockConfig>;

  afterEach(() => {
    state?.restore();
  });

  it("creates global config file from partial config", () => {
    state = mockConfig({ global: { activeModel: "qwen3:8b" } });
    expect(fileExists(GLOBAL_CONFIG_PATH)).toBe(true);
    const content = parse(readFile(GLOBAL_CONFIG_PATH));
    expect(content.activeModel).toBe("qwen3:8b");
  });

  it("creates local config file from partial config", () => {
    state = mockConfig({ local: { activeModel: "llama3:70b" } });
    expect(fileExists(LOCAL_CONFIG_PATH)).toBe(true);
    const content = parse(readFile(LOCAL_CONFIG_PATH));
    expect(content.activeModel).toBe("llama3:70b");
  });

  it("creates both global and local config files", () => {
    state = mockConfig({
      global: { activeModel: "qwen3:8b" },
      local: { activeModel: "llama3:70b" },
    });
    expect(fileExists(GLOBAL_CONFIG_PATH)).toBe(true);
    expect(fileExists(LOCAL_CONFIG_PATH)).toBe(true);
  });

  it("creates no files when no options given", () => {
    state = mockConfig();
    expect(fileExists(GLOBAL_CONFIG_PATH)).toBe(false);
    expect(fileExists(LOCAL_CONFIG_PATH)).toBe(false);
  });
});
