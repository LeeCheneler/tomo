import { z } from "zod";
import type { Permissions, Provider, Tools } from "./schema";
import { providerSchema } from "./schema";
import { updateGlobalConfig, updateLocalConfig } from "./file";

/** Sets the active model in the global config. */
export function updateActiveModel(model: string): void {
  updateGlobalConfig((raw) => ({ ...raw, activeModel: model }));
}

/** Sets the active provider in the global config. */
export function updateActiveProvider(provider: string): void {
  updateGlobalConfig((raw) => ({ ...raw, activeProvider: provider }));
}

/** Schema for parsing just the providers array from raw config. */
const providersFieldSchema = z.object({
  providers: z.array(providerSchema).default([]),
});

/** Appends a provider to the global config. */
export function addProvider(provider: Provider): void {
  updateGlobalConfig((raw) => {
    const { providers } = providersFieldSchema.parse(raw);
    return { ...raw, providers: [...providers, provider] };
  });
}

/** Removes a provider by name from the global config. */
export function removeProvider(name: string): void {
  updateGlobalConfig((raw) => {
    const { providers } = providersFieldSchema.parse(raw);
    return {
      ...raw,
      providers: providers.filter((p) => p.name !== name),
    };
  });
}

/** Sets permissions in the local config. */
export function updatePermissions(permissions: Permissions): void {
  updateLocalConfig((raw) => ({ ...raw, permissions }));
}

/** Sets allowed commands in the local config. */
export function updateAllowedCommands(commands: string[]): void {
  updateLocalConfig((raw) => ({ ...raw, allowedCommands: commands }));
}

/** Sets tool config in the local config. */
export function updateTools(tools: Tools): void {
  updateLocalConfig((raw) => ({ ...raw, tools }));
}
