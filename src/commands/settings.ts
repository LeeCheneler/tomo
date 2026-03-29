import { createElement } from "react";
import {
  SettingsSelector,
  type SettingsState,
  type ToolMeta,
} from "../components/settings-selector";
import {
  addMcpServer,
  getAllMcpServers,
  getAllowedCommands,
  getSkillSetSources,
  loadConfig,
  removeMcpServer,
  updateLocalAllowedCommands,
  updateLocalPermissions,
  updateLocalToolConfig,
  updateSkillSetSources,
} from "../config";
import { resolvePermissions } from "../permissions";
import { getAllTools, resolveToolAvailability } from "../tools";
import { register } from "./registry";
import type { Command } from "./types";

function saveSettings(state: SettingsState): void {
  // Local config: tools, permissions, allowed commands
  updateLocalToolConfig(state.toolAvailability);
  updateLocalPermissions(state.permissions);
  updateLocalAllowedCommands(state.allowedCommands);

  // Global config: skill set sources
  updateSkillSetSources(state.skillSetSources);

  // Global config: MCP servers
  const currentConfig = loadConfig();
  const existingServers = getAllMcpServers(currentConfig);

  for (const name of Object.keys(existingServers)) {
    if (!state.mcpServers[name]) {
      removeMcpServer(name);
    }
  }

  for (const [name, server] of Object.entries(state.mcpServers)) {
    // Always write the full server config to persist all fields (headers, etc.)
    addMcpServer(name, server);
  }
}

const settings: Command = {
  name: "settings",
  description: "Manage tools, permissions, commands, and MCP servers",
  execute: (_args, callbacks) => {
    const config = loadConfig();

    const allTools = getAllTools();
    const toolAvailability = resolveToolAvailability(config.tools);
    const toolWarnings: Record<string, string> = {};
    const toolDisplayNames: Record<string, string> = {};
    const toolDescriptions: Record<string, string> = {};
    for (const tool of allTools) {
      const msg = tool.warning?.();
      if (msg) toolWarnings[tool.name] = msg;
      toolDisplayNames[tool.name] = tool.displayName ?? tool.name;
      const desc = tool.description.split(".")[0];
      toolDescriptions[tool.name] =
        desc.charAt(0).toUpperCase() + desc.slice(1);
    }

    const toolMeta: ToolMeta = {
      names: allTools.map((t) => t.name),
      displayNames: toolDisplayNames,
      descriptions: toolDescriptions,
      warnings: toolWarnings,
    };

    const initialState: SettingsState = {
      toolAvailability,
      permissions: resolvePermissions(config.permissions),
      allowedCommands: getAllowedCommands(config),
      mcpServers: getAllMcpServers(config),
      skillSetSources: getSkillSetSources(config),
    };

    return {
      interactive: createElement(SettingsSelector, {
        initialState,
        toolMeta,
        mcpFailedServers: new Set(callbacks.mcpFailedServers),
        onSave: (state: SettingsState) => {
          saveSettings(state);
          callbacks.onComplete({ output: "Settings updated." });
        },
      }),
    };
  },
};

register(settings);
