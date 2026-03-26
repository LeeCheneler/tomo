import { createElement } from "react";
import { SettingsSelector } from "../components/settings-selector";
import {
  getAllowedCommands,
  loadConfig,
  updateLocalAllowedCommands,
  updateLocalPermissions,
  updateLocalToolConfig,
} from "../config";
import { resolvePermissions } from "../permissions";
import { getAllTools, resolveToolAvailability } from "../tools";
import { register } from "./registry";
import type { Command } from "./types";

const settings: Command = {
  name: "settings",
  description: "Manage tools, permissions, and command patterns",
  execute: (_args, callbacks) => {
    const config = loadConfig();

    // Tool availability
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

    // Permissions
    const permissions = resolvePermissions(config.permissions);

    const allowedCommands = getAllowedCommands(config);

    return {
      interactive: createElement(SettingsSelector, {
        tools: allTools.map((t) => t.name),
        toolDisplayNames,
        toolDescriptions,
        currentToolAvailability: toolAvailability,
        toolWarnings,
        currentPermissions: permissions,
        currentAllowedCommands: allowedCommands,
        onSave: (
          updatedToolAvailability: Record<string, boolean>,
          updatedPermissions: Record<string, boolean>,
          updatedAllowedCommands: string[],
        ) => {
          updateLocalToolConfig(updatedToolAvailability);
          updateLocalPermissions(updatedPermissions);
          updateLocalAllowedCommands(updatedAllowedCommands);
          callbacks.onComplete({ output: "Settings updated." });
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(settings);
