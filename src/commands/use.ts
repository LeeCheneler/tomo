import { createElement } from "react";
import { ModelSelector } from "../components/model-selector";
import { fetchModels } from "../provider/client";
import { register } from "./registry";
import type { Command } from "./types";

/** Validates a model exists on the given provider. Returns an error string or null. */
async function validateModel(
  baseUrl: string,
  model: string,
): Promise<string | null> {
  try {
    const models = await fetchModels(baseUrl);
    const exists = models.some((m) => m.id === model);
    if (!exists) {
      const available = models.map((m) => m.id).join(", ");
      return `Unknown model: ${model}. Available: ${available}`;
    }
    return null;
  } catch {
    return `Could not validate model: failed to fetch models from provider.`;
  }
}

const use: Command = {
  name: "use",
  description: "Switch the active model or provider/model",
  execute: async (args, callbacks) => {
    const input = args.trim();

    if (input) {
      const slashIndex = input.indexOf("/");
      if (slashIndex >= 0) {
        const providerName = input.slice(0, slashIndex);
        const model = input.slice(slashIndex + 1);
        if (!providerName || !model) {
          return { output: "Usage: /use provider/model or /use model" };
        }
        const providerError = callbacks.setActiveProvider(providerName);
        if (providerError) return { output: providerError };
        const modelError = await validateModel(
          callbacks.providerBaseUrl,
          model,
        );
        if (modelError) return { output: modelError };
        callbacks.setActiveModel(model);
        return { output: `Switched to ${providerName}/${model}.` };
      }

      const modelError = await validateModel(callbacks.providerBaseUrl, input);
      if (modelError) return { output: modelError };
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
