import { createElement } from "react";
import { ModelSelector } from "../components/model-selector";
import { ok } from "../tools/types";
import { register } from "./registry";
import type { Command } from "./types";

const model: Command = {
  name: "model",
  description: "Switch the active model",
  execute: (_args, callbacks) => {
    return {
      interactive: createElement(ModelSelector, {
        providers: callbacks.providers,
        activeProvider: callbacks.activeProvider,
        activeModel: callbacks.activeModel,
        onSelect: (provider: string, selectedModel: string) => {
          callbacks.setActiveProvider(provider);
          callbacks.setActiveModel(selectedModel);
          callbacks.onComplete(ok(`Switched to ${provider}/${selectedModel}.`));
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(model);
