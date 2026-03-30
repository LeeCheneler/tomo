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

/** Schema for the application config. */
export const configSchema = z.object({
  activeModel: z.string().nullish(),
  activeProvider: z.string().nullish(),
  providers: z.array(providerSchema).default([]),
});

/** A single provider connection. */
export type Provider = z.infer<typeof providerSchema>;

/** Supported provider type. */
export type ProviderType = z.infer<typeof providerTypeSchema>;

/** Application config type inferred from the schema. */
export type Config = z.infer<typeof configSchema>;
