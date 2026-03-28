import { createElement } from "react";
import { SettingsSelector } from "../components/settings-selector";
import {
  addMcpServer,
  getAllMcpServers,
  getAllowedCommands,
  loadConfig,
  removeMcpServer,
  updateLocalAllowedCommands,
  updateLocalPermissions,
  updateLocalToolConfig,
  updateMcpServerEnabled,
} from "../config";
import { decodeToolName } from "../mcp/manager";
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

    // Include MCP tools from config in the tool list
    const mcpToolNames: string[] = [];
    if (config.tools) {
      for (const name of Object.keys(config.tools)) {
        const decoded = decodeToolName(name);
        if (decoded) {
          mcpToolNames.push(name);
          toolDisplayNames[name] =
            `MCP → ${decoded.serverName} → ${decoded.toolName}`;
          toolAvailability[name] = config.tools[name] ?? false;
        }
      }
    }

    // Permissions
    const permissions = resolvePermissions(config.permissions);

    const allowedCommands = getAllowedCommands(config);
    const mcpServers = getAllMcpServers(config);

    return {
      interactive: createElement(SettingsSelector, {
        tools: [...allTools.map((t) => t.name), ...mcpToolNames],
        toolDisplayNames,
        toolDescriptions,
        currentToolAvailability: toolAvailability,
        toolWarnings,
        currentPermissions: permissions,
        currentAllowedCommands: allowedCommands,
        mcpServers,
        mcpFailedServers: new Set(callbacks.mcpFailedServers),
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
        onAddMcpServer: (
          name: string,
          server: import("../config").McpServerConfig,
          toolNames: string[],
        ) => {
          addMcpServer(name, server);
          // Disable all discovered MCP tools by default
          const freshConfig = loadConfig();
          const currentTools = freshConfig.tools ?? {};
          const updated = { ...currentTools };
          for (const toolName of toolNames) {
            updated[toolName] = false;
          }
          updateLocalToolConfig(updated);
        },
        onRemoveMcpServer: (name: string) => {
          removeMcpServer(name);
          // Remove tools belonging to this server from local config
          const freshConfig = loadConfig();
          const currentTools = freshConfig.tools ?? {};
          const prefix = `mcp__${name}__`;
          const cleaned: Record<string, boolean> = {};
          for (const [key, value] of Object.entries(currentTools)) {
            if (!key.startsWith(prefix)) {
              cleaned[key] = value;
            }
          }
          updateLocalToolConfig(cleaned);
        },
        onToggleMcpServer: updateMcpServerEnabled,
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(settings);
