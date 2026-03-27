import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve } from "node:path";
import { parse, stringify } from "yaml";
import { z } from "zod";

const modelOverrideSchema = z.object({
  maxTokens: z.number().int().positive().optional(),
});

const providerSchema = z.object({
  name: z.string().min(1, "provider name is required"),
  type: z.enum(["ollama", "opencode-zen", "openrouter"], {
    message:
      'unsupported provider type. Supported: "ollama", "opencode-zen", "openrouter"',
  }),
  baseUrl: z.string().url("baseUrl must be a valid URL"),
  apiKey: z.string().optional(),
  contextWindow: z.number().int().positive().optional(),
  models: z.record(z.string(), modelOverrideSchema).optional(),
});

const permissionsSchema = z
  .object({
    read_file: z.boolean().optional(),
    write_file: z.boolean().optional(),
  })
  .optional();

const toolsSchema = z.record(z.string(), z.boolean()).optional();

const agentsSchema = z
  .object({
    maxDepth: z.number().int().positive().default(1),
    maxConcurrent: z.number().int().positive().default(3),
    timeoutSeconds: z.number().int().positive().default(300),
    tools: z
      .array(z.string())
      .default(["read_file", "glob", "grep", "web_search", "skill"]),
  })
  .optional();

const configSchema = z.object({
  activeProvider: z.string().default(""),
  activeModel: z.string().default(""),
  maxTokens: z.number().int().positive().default(8192),
  providers: z.array(providerSchema),
  permissions: permissionsSchema,
  tools: toolsSchema,
  agents: agentsSchema,
  allowed_commands: z.array(z.string()).optional(),
});

export type ProviderConfig = z.infer<typeof providerSchema>;
export type Config = z.infer<typeof configSchema>;

export interface AgentsConfig {
  maxDepth: number;
  maxConcurrent: number;
  timeoutSeconds: number;
  tools: string[];
}

const DEFAULT_AGENTS_CONFIG: AgentsConfig = {
  maxDepth: 1,
  maxConcurrent: 3,
  timeoutSeconds: 300,
  tools: ["read_file", "glob", "grep", "web_search", "skill"],
};

/** Resolves agent config with defaults for any missing fields. */
export function getAgentsConfig(config: Config): AgentsConfig {
  if (!config.agents) return DEFAULT_AGENTS_CONFIG;
  return { ...DEFAULT_AGENTS_CONFIG, ...config.agents };
}

const DEFAULT_CONFIG: Config = {
  activeProvider: "",
  activeModel: "",
  maxTokens: 8192,
  providers: [],
};

const DEFAULT_CONFIG_YAML = `activeProvider: ""
activeModel: ""
maxTokens: 8192
providers: []
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

/** Load a YAML config file, apply an updater, and write it back. Creates the file and directories if absent. */
function updateConfigFile(
  path: string,
  updater: (raw: Record<string, unknown>) => void,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const raw = loadYaml(path) ?? {};
  updater(raw);
  writeFileSync(path, stringify(raw), "utf-8");
}

/** Updates activeModel in the global config. */
export function updateActiveModel(model: string): void {
  updateConfigFile(globalConfigPath(), (raw) => {
    raw.activeModel = model;
  });
}

/** Updates activeProvider in the global config. */
export function updateActiveProvider(provider: string): void {
  updateConfigFile(globalConfigPath(), (raw) => {
    raw.activeProvider = provider;
  });
}

/** Updates permissions in the local project config (.tomo/config.yaml). */
export function updateLocalPermissions(
  permissions: Record<string, boolean>,
): void {
  updateConfigFile(localConfigPath(), (raw) => {
    raw.permissions = permissions;
  });
}

/** Updates tool availability in the local project config (.tomo/config.yaml). */
export function updateLocalToolConfig(tools: Record<string, boolean>): void {
  updateConfigFile(localConfigPath(), (raw) => {
    raw.tools = tools;
  });
}

/** Adds a provider to the global config file. */
export function addProvider(provider: ProviderConfig): void {
  updateConfigFile(globalConfigPath(), (raw) => {
    const providers = (raw.providers as ProviderConfig[]) ?? [];
    providers.push(provider);
    raw.providers = providers;
  });
}

/** Removes a provider by name from the global config file. */
export function removeProvider(name: string): void {
  updateConfigFile(globalConfigPath(), (raw) => {
    const providers = (raw.providers as ProviderConfig[]) ?? [];
    raw.providers = providers.filter((p) => p.name !== name);
  });
}

/** Returns a provider config by name, or undefined if not found. */
export function getProviderByName(
  config: Config,
  name: string,
): ProviderConfig | undefined {
  return config.providers.find((p) => p.name === name);
}

/** Resolves the effective maxTokens for a model: model override > global default. */
export function getMaxTokens(
  config: Config,
  provider: ProviderConfig,
  model: string,
): number {
  return provider.models?.[model]?.maxTokens ?? config.maxTokens;
}

/** Returns allowed commands from config, falling back to empty. */
export function getAllowedCommands(config: Config): string[] {
  return config.allowed_commands ?? [];
}

/** Adds a command to the allowed_commands list in local config. Deduplicates. */
export function addAllowedCommand(command: string): void {
  updateConfigFile(localConfigPath(), (raw) => {
    const existing = (raw.allowed_commands as string[]) ?? [];
    if (!existing.includes(command)) {
      existing.push(command);
    }
    raw.allowed_commands = existing;
  });
}

/** Updates allowed commands in the local project config. */
export function updateLocalAllowedCommands(commands: string[]): void {
  updateConfigFile(localConfigPath(), (raw) => {
    raw.allowed_commands = commands;
  });
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
