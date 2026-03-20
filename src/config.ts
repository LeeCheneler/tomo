import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";

const providerSchema = z.object({
  name: z.string().min(1, "provider name is required"),
  type: z.enum(["ollama"], {
    message: 'unsupported provider type. Supported: "ollama"',
  }),
  baseUrl: z.string().url("baseUrl must be a valid URL"),
});

const configSchema = z
  .object({
    activeProvider: z.string().min(1, "activeProvider is required"),
    activeModel: z.string().min(1, "activeModel is required"),
    providers: z
      .array(providerSchema)
      .min(1, "providers must be a non-empty array"),
  })
  .check((ctx) => {
    const names = ctx.value.providers.map((p) => p.name);
    if (!names.includes(ctx.value.activeProvider)) {
      ctx.issues.push({
        code: "custom",
        message: `activeProvider "${ctx.value.activeProvider}" does not match any provider. Available: ${names.join(", ")}`,
        input: ctx.value,
        path: ["activeProvider"],
      });
    }
  });

export type ProviderConfig = z.infer<typeof providerSchema>;
export type Config = z.infer<typeof configSchema>;

const DEFAULT_CONFIG: Config = {
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

const DEFAULT_CONFIG_YAML = `activeProvider: ollama
activeModel: qwen3:8b

providers:
  - name: ollama
    type: ollama
    baseUrl: http://localhost:11434
`;

/** Returns the path to the global config file (~/.tomo/config.yaml). */
function globalConfigPath(): string {
  return resolve(homedir(), ".tomo", "config.yaml");
}

/** Returns the path to the local config file (./.tomo/config.yaml). */
function localConfigPath(): string {
  return resolve(process.cwd(), ".tomo", "config.yaml");
}

/** Loads and parses a YAML config file. Returns null if the file does not exist. */
function loadYaml(path: string): Record<string, unknown> | null {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, "utf-8");
  return parse(content) as Record<string, unknown>;
}

/** Creates the default config file at the given path, creating directories as needed. */
function createDefaultConfig(path: string): void {
  const dir = dirname(path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, DEFAULT_CONFIG_YAML, "utf-8");
}

/**
 * Loads the config from global (~/.tomo/config.yaml) and local (./.tomo/config.yaml) files.
 * Local config is merged on top of global. Creates a default global config on first run.
 */
export function loadConfig(): Config {
  const globalPath = globalConfigPath();
  const localPath = localConfigPath();

  let global = loadYaml(globalPath);
  if (!global) {
    createDefaultConfig(globalPath);
    global = DEFAULT_CONFIG;
  }

  const local = loadYaml(localPath);

  const merged = {
    ...DEFAULT_CONFIG,
    ...global,
    ...local,
  };

  const result = configSchema.safeParse(merged);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Config validation failed:\n${message}`);
  }

  return result.data;
}

/** Updates activeModel in config files on disk. Updates local if present, always updates global. */
export function updateActiveModel(model: string): void {
  const paths = [globalConfigPath()];
  const local = localConfigPath();
  if (existsSync(local)) paths.push(local);

  for (const path of paths) {
    const raw = loadYaml(path);
    if (!raw) continue;
    raw.activeModel = model;
    writeFileSync(path, stringify(raw), "utf-8");
  }
}

/** Returns the provider config matching the activeProvider name. Throws if not found. */
export function getActiveProvider(config: Config): ProviderConfig {
  const provider = config.providers.find(
    (p) => p.name === config.activeProvider,
  );
  if (!provider) {
    throw new Error(
      `Config: active provider "${config.activeProvider}" not found`,
    );
  }
  return provider;
}
