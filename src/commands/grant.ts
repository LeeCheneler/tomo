import { createElement } from "react";
import { GrantSelector } from "../components/grant-selector";
import { loadConfig, updateLocalPermissions } from "../config";
import { resolvePermissions } from "../permissions";
import { register } from "./registry";
import type { Command } from "./types";

const grant: Command = {
  name: "grant",
  description: "Manage tool permissions",
  execute: (_args, callbacks) => {
    const config = loadConfig();
    const current = resolvePermissions(config.permissions);

    return {
      interactive: createElement(GrantSelector, {
        currentPermissions: current,
        onSave: (updated: Record<string, boolean>) => {
          updateLocalPermissions(updated);
          callbacks.onComplete({ output: "Permissions updated." });
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(grant);
