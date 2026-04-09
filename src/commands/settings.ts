import { createElement } from "react";
import { Settings } from "../settings/settings";
import type { CommandDefinition } from "./registry";

/** Opens the settings panel as a takeover screen. */
export const settingsCommand: CommandDefinition = {
  name: "settings",
  description: "Manage settings",
  takeover: (onDone) => createElement(Settings, { onDone }),
};
