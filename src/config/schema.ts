import { z } from "zod";

/** Supported provider API types. */
export const providerTypeSchema = z.enum([
  "ollama",
  "opencode-zen",
  "openrouter",
  "mlx",
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
  cwdRemoveFile: z.boolean().optional(),
  cwdRemoveDir: z.boolean().optional(),
  globalReadFile: z.boolean().optional(),
  globalWriteFile: z.boolean().optional(),
  globalRemoveFile: z.boolean().optional(),
  globalRemoveDir: z.boolean().optional(),
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
  agent: toolConfigSchema.default({ enabled: true }),
  ask: toolConfigSchema.default({ enabled: true }),
  editFile: toolConfigSchema.default({ enabled: true }),
  glob: toolConfigSchema.default({ enabled: true }),
  grep: toolConfigSchema.default({ enabled: true }),
  readFile: toolConfigSchema.default({ enabled: true }),
  removeDir: toolConfigSchema.default({ enabled: true }),
  removeFile: toolConfigSchema.default({ enabled: true }),
  runCommand: toolConfigSchema.default({ enabled: true }),
  skill: toolConfigSchema.default({ enabled: true }),
  webSearch: webSearchToolConfigSchema.default({ enabled: false }),
  writeFile: toolConfigSchema.default({ enabled: true }),
});

/** Schema for agent spawning configuration. */
export const agentsSchema = z.object({
  maxDepth: z.number().int().positive().default(1),
  maxConcurrent: z.number().int().positive().default(3),
  maxTimeoutSeconds: z.number().int().positive().default(300),
  // Open string array rather than enum so users can allow-list third-party MCP tools too
  tools: z
    .array(z.string())
    .default([
      "read_file",
      "glob",
      "grep",
      "web_search",
      "skill",
      "run_command",
    ]),
});

/** Schema for an MCP stdio connection. */
export const mcpStdioConnectionSchema = z.object({
  transport: z.literal("stdio"),
  command: z.string().min(1, "command is required"),
  args: z.array(z.string()).default([]),
  env: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
});

/** Schema for an MCP HTTP connection. */
export const mcpHttpConnectionSchema = z.object({
  transport: z.literal("http"),
  url: z.url("url must be a valid URL"),
  headers: z.record(z.string(), z.string()).optional(),
  enabled: z.boolean().default(true),
});

/** Schema for an MCP connection (stdio or HTTP). */
export const mcpConnectionSchema = z.discriminatedUnion("transport", [
  mcpStdioConnectionSchema,
  mcpHttpConnectionSchema,
]);

/** Schema for MCP configuration. */
export const mcpSchema = z.object({
  connections: z.record(z.string(), mcpConnectionSchema).default({}),
});

/** Schema for a skill set source (git repo) with its enabled sets. */
export const skillSetSourceSchema = z.object({
  url: z.string().min(1, "source URL is required"),
  enabledSets: z.array(z.string()).default([]),
});

/** Schema for skill set configuration. */
export const skillSetsSchema = z.object({
  sources: z.array(skillSetSourceSchema).default([]),
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
    tools: ["read_file", "glob", "grep", "web_search", "skill", "run_command"],
  }),
  mcp: mcpSchema.default({ connections: {} }),
  skillSets: skillSetsSchema.default({ sources: [] }),
  tools: toolsSchema.prefault({}),
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

/** An MCP connection (stdio or HTTP). */
export type McpConnection = z.infer<typeof mcpConnectionSchema>;

/** MCP configuration. */
export type Mcp = z.infer<typeof mcpSchema>;

/** A skill set source (git repo) with its enabled sets. */
export type SkillSetSource = z.infer<typeof skillSetSourceSchema>;

/** Skill set configuration. */
export type SkillSets = z.infer<typeof skillSetsSchema>;

/** Application config type inferred from the schema. */
export type Config = z.infer<typeof configSchema>;
