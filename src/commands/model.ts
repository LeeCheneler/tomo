import { createElement } from "react";
import { ModelSelector } from "../model/model-selector";
import type { CommandDefinition } from "./registry";

/** Opens the model selector as a takeover screen. */
export const modelCommand: CommandDefinition = {
  name: "model",
  description: "Select a model",
  takeover: (onDone) => createElement(ModelSelector, { onDone }),
};
