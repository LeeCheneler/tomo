import { createElement } from "react";
import { ModelSelector } from "../components/model-selector";
import { register } from "./registry";
import type { Command } from "./types";

const use: Command = {
  name: "use",
  description: "Switch the active model or provider/model",
  execute: (args, callbacks) => {
    const input = args.trim();

    if (input) {
      const slashIndex = input.indexOf("/");
      if (slashIndex >= 0) {
        const providerName = input.slice(0, slashIndex);
        const model = input.slice(slashIndex + 1);
        if (!providerName || !model) {
          return { output: "Usage: /use provider/model or /use model" };
        }
        const error = callbacks.setActiveProvider(providerName);
        if (error) return { output: error };
        callbacks.setActiveModel(model);
        return { output: `Switched to ${providerName}/${model}.` };
      }
      callbacks.setActiveModel(input);
      return { output: `Switched to ${input}.` };
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
