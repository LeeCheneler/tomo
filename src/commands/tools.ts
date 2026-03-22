import { createElement } from "react";
import { ToolSelector } from "../components/tool-selector";
import { loadConfig, updateLocalToolConfig } from "../config";
import { getAllTools, resolveToolAvailability } from "../tools";
import { register } from "./registry";
import type { Command } from "./types";

const tools: Command = {
  name: "tools",
  description: "Manage tool availability",
  execute: (_args, callbacks) => {
    const config = loadConfig();
    const allTools = getAllTools();
    const current = resolveToolAvailability(config.tools);

    const warnings: Record<string, string> = {};
    for (const tool of allTools) {
      const msg = tool.warning?.();
      if (msg) warnings[tool.name] = msg;
    }

    return {
      interactive: createElement(ToolSelector, {
        tools: allTools.map((t) => t.name),
        currentAvailability: current,
        warnings,
        onSave: (updated: Record<string, boolean>) => {
          updateLocalToolConfig(updated);
          callbacks.onComplete({ output: "Tool availability updated." });
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(tools);
