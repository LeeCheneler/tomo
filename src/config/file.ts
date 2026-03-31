import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { ensureDir, fileExists, readFile, writeFile } from "../utils/fs";
import { type Config, configSchema } from "./schema";

/** Path to the global config file (~/.tomo/config.yaml). */
export const GLOBAL_CONFIG_PATH = resolve(homedir(), ".tomo", "config.yaml");

/** Path to the local config file (.tomo/config.yaml in cwd). */
export const LOCAL_CONFIG_PATH = resolve(process.cwd(), ".tomo", "config.yaml");

/** Default global config YAML written on first run. */
const DEFAULT_CONFIG_YAML = `activeProvider: null
activeModel: null
providers: []
`;

/** Loads and parses a YAML file. Returns null if the file does not exist. */
function loadYaml(path: string): Record<string, unknown> | null {
  if (!fileExists(path)) return null;
  const content = readFile(path);
  return (parse(content) as Record<string, unknown>) ?? null;
}

/** Creates the default config file at the given path. */
function createDefaultConfig(path: string): void {
  ensureDir(dirname(path));
  writeFile(path, DEFAULT_CONFIG_YAML);
}

/**
 * Loads config from global and local YAML files, merges them, and validates.
 * Creates a default global config on first run if none exists.
 * Local config is merged on top of global.
 */
export function loadConfig(): Config {
  let global = loadYaml(GLOBAL_CONFIG_PATH);
  if (!global) {
    createDefaultConfig(GLOBAL_CONFIG_PATH);
    global = loadYaml(GLOBAL_CONFIG_PATH);
  }

  const local = loadYaml(LOCAL_CONFIG_PATH);
  const merged = { ...global, ...local };

  const result = configSchema.safeParse(merged);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${message}`);
  }

  return result.data;
}

/** Writes a partial config object to the global config file as YAML. */
export function saveGlobalConfig(config: Partial<Config>): void {
  ensureDir(dirname(GLOBAL_CONFIG_PATH));
  writeFile(GLOBAL_CONFIG_PATH, stringify(config));
}

/** Writes a partial config object to the local config file as YAML. */
export function saveLocalConfig(config: Partial<Config>): void {
  ensureDir(dirname(LOCAL_CONFIG_PATH));
  writeFile(LOCAL_CONFIG_PATH, stringify(config));
}

/** Reads the global config file, applies an updater, and writes the result back. */
export function updateGlobalConfig(
  updater: (raw: Record<string, unknown>) => Record<string, unknown>,
): void {
  ensureDir(dirname(GLOBAL_CONFIG_PATH));
  const raw = loadYaml(GLOBAL_CONFIG_PATH) ?? {};
  writeFile(GLOBAL_CONFIG_PATH, stringify(updater(raw)));
}

/** Reads the local config file, applies an updater, and writes the result back. */
export function updateLocalConfig(
  updater: (raw: Record<string, unknown>) => Record<string, unknown>,
): void {
  ensureDir(dirname(LOCAL_CONFIG_PATH));
  const raw = loadYaml(LOCAL_CONFIG_PATH) ?? {};
  writeFile(LOCAL_CONFIG_PATH, stringify(updater(raw)));
}
