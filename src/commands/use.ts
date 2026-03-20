import { createElement } from "react";
import { ModelSelector } from "../components/model-selector";
import { register } from "./registry";
import type { Command } from "./types";

const use: Command = {
  name: "use",
  description: "Switch the active model",
  execute: (args, callbacks) => {
    const model = args.trim();

    if (model) {
      callbacks.setActiveModel(model);
      return { output: `Switched to ${model}.` };
    }

    return {
      interactive: createElement(ModelSelector, {
        baseUrl: callbacks.providerBaseUrl,
        activeModel: callbacks.activeModel,
        onSelect: (selected: string) => {
          callbacks.setActiveModel(selected);
          callbacks.onComplete({ output: `Switched to ${selected}.` });
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(use);
