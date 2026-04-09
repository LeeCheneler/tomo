import { z } from "zod";
import type {
  McpConnection,
  Permissions,
  Provider,
  SkillSetSource,
  Tools,
} from "./schema";
import {
  mcpConnectionSchema,
  providerSchema,
  skillSetSourceSchema,
} from "./schema";
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

/** Schema for parsing just the mcp field from raw config. */
const mcpFieldSchema = z.object({
  mcp: z
    .object({
      connections: z.record(z.string(), mcpConnectionSchema).default({}),
    })
    .default({ connections: {} }),
});

/** Adds a new MCP connection to the global config under the given name. */
export function addMcpConnection(
  name: string,
  connection: McpConnection,
): void {
  updateGlobalConfig((raw) => {
    const { mcp } = mcpFieldSchema.parse(raw);
    return {
      ...raw,
      mcp: {
        connections: { ...mcp.connections, [name]: connection },
      },
    };
  });
}

/** Removes an MCP connection by name from the global config. */
export function removeMcpConnection(name: string): void {
  updateGlobalConfig((raw) => {
    const { mcp } = mcpFieldSchema.parse(raw);
    const next = { ...mcp.connections };
    delete next[name];
    return { ...raw, mcp: { connections: next } };
  });
}

/**
 * Updates an MCP connection in the global config. Supports rename: if `name`
 * differs from `originalName`, the entry is moved while preserving its
 * insertion position so the UI list stays stable.
 */
export function updateMcpConnection(
  originalName: string,
  name: string,
  connection: McpConnection,
): void {
  updateGlobalConfig((raw) => {
    const { mcp } = mcpFieldSchema.parse(raw);
    const next: Record<string, McpConnection> = {};
    for (const [key, value] of Object.entries(mcp.connections)) {
      if (key === originalName) {
        next[name] = connection;
      } else {
        next[key] = value;
      }
    }
    // Handle the case where the original key wasn't present (defensive).
    if (!(originalName in mcp.connections)) {
      next[name] = connection;
    }
    return { ...raw, mcp: { connections: next } };
  });
}
