import { z } from "zod";

/** Supported provider API types. */
export const providerTypeSchema = z.enum([
  "ollama",
  "opencode-zen",
  "openrouter",
]);

/** Schema for a single provider connection. */
export const providerSchema = z.object({
  name: z.string().min(1, "provider name is required"),
  type: providerTypeSchema,
  baseUrl: z.url("baseUrl must be a valid URL"),
  apiKey: z.string().optional(),
});

/** Schema for file access permissions. */
export const permissionsSchema = z.object({
  cwdReadFile: z.boolean().default(true),
  cwdWriteFile: z.boolean().optional(),
  globalReadFile: z.boolean().optional(),
  globalWriteFile: z.boolean().optional(),
});

/** Schema for a single tool's config. */
export const toolConfigSchema = z.object({
  enabled: z.boolean(),
});

/** Schema for web search tool configuration. */
export const webSearchToolConfigSchema = toolConfigSchema.extend({
  apiKey: z.string().optional(),
});

/** Schema for first-party tool configuration. */
export const toolsSchema = z.object({
  agent: toolConfigSchema,
  ask: toolConfigSchema,
  editFile: toolConfigSchema,
  glob: toolConfigSchema,
  grep: toolConfigSchema,
  readFile: toolConfigSchema,
  runCommand: toolConfigSchema,
  skill: toolConfigSchema,
  webSearch: webSearchToolConfigSchema,
  writeFile: toolConfigSchema,
});

/** Schema for agent spawning configuration. */
export const agentsSchema = z.object({
  maxDepth: z.number().int().positive().default(1),
  maxConcurrent: z.number().int().positive().default(3),
  maxTimeoutSeconds: z.number().int().positive().default(300),
  // Open string array rather than enum so users can allow-list third-party MCP tools too
  tools: z
    .array(z.string())
    .default(["readFile", "glob", "grep", "webSearch", "skill"]),
});

/** Schema for the application config. */
export const configSchema = z.object({
  activeModel: z.string().nullish(),
  activeProvider: z.string().nullish(),
  providers: z.array(providerSchema).default([]),
  permissions: permissionsSchema.default({ cwdReadFile: true }),
  allowedCommands: z.array(z.string()).default([]),
  agents: agentsSchema.default({
    maxDepth: 1,
    maxConcurrent: 3,
    maxTimeoutSeconds: 300,
    tools: ["readFile", "glob", "grep", "webSearch", "skill"],
  }),
  tools: toolsSchema.default({
    agent: { enabled: true },
    ask: { enabled: true },
    editFile: { enabled: true },
    glob: { enabled: true },
    grep: { enabled: true },
    readFile: { enabled: true },
    runCommand: { enabled: true },
    skill: { enabled: true },
    webSearch: { enabled: false },
    writeFile: { enabled: true },
  }),
});

/** A single provider connection. */
export type Provider = z.infer<typeof providerSchema>;

/** Supported provider type. */
export type ProviderType = z.infer<typeof providerTypeSchema>;

/** File access permissions. */
export type Permissions = z.infer<typeof permissionsSchema>;

/** Config for a single tool. */
export type ToolConfig = z.infer<typeof toolConfigSchema>;

/** Config for the web search tool. */
export type WebSearchToolConfig = z.infer<typeof webSearchToolConfigSchema>;

/** Tool configuration map. */
export type Tools = z.infer<typeof toolsSchema>;

/** Agent spawning configuration. */
export type Agents = z.infer<typeof agentsSchema>;

/** Application config type inferred from the schema. */
export type Config = z.infer<typeof configSchema>;
