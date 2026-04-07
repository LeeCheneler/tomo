import { z } from "zod";
import type { Permissions, Provider, SkillSetSource, Tools } from "./schema";
import { providerSchema, skillSetSourceSchema } from "./schema";
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

/** Updates an existing provider by its original name in the global config. */
export function updateProvider(originalName: string, provider: Provider): void {
  updateGlobalConfig((raw) => {
    const { providers } = providersFieldSchema.parse(raw);
    return {
      ...raw,
      providers: providers.map((p) => (p.name === originalName ? provider : p)),
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

/** Schema for parsing just the skillSets field from raw config. */
const skillSetsFieldSchema = z.object({
  skillSets: z
    .object({ sources: z.array(skillSetSourceSchema).default([]) })
    .default({ sources: [] }),
});

/** Adds a skill set source to the global config. */
export function addSkillSetSource(source: SkillSetSource): void {
  updateGlobalConfig((raw) => {
    const { skillSets } = skillSetsFieldSchema.parse(raw);
    return {
      ...raw,
      skillSets: { sources: [...skillSets.sources, source] },
    };
  });
}

/** Removes a skill set source by URL from the global config. */
export function removeSkillSetSource(url: string): void {
  updateGlobalConfig((raw) => {
    const { skillSets } = skillSetsFieldSchema.parse(raw);
    return {
      ...raw,
      skillSets: {
        sources: skillSets.sources.filter((s) => s.url !== url),
      },
    };
  });
}

/** Updates the enabled sets for a skill set source in the global config. */
export function updateSkillSetEnabledSets(
  url: string,
  enabledSets: string[],
): void {
  updateGlobalConfig((raw) => {
    const { skillSets } = skillSetsFieldSchema.parse(raw);
    return {
      ...raw,
      skillSets: {
        sources: skillSets.sources.map((s) =>
          s.url === url ? { ...s, enabledSets } : s,
        ),
      },
    };
  });
}
