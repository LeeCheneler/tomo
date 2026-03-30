import { createElement } from "react";
import { ConfigureSelector } from "../components/configure-selector";
import { addProvider, type ProviderConfig, removeProvider } from "../config";
import { ok } from "../tools/types";
import { register } from "./registry";
import type { Command } from "./types";

const provider: Command = {
  name: "provider",
  description: "Manage providers (add/remove)",
  execute: (_args, callbacks) => {
    return {
      interactive: createElement(ConfigureSelector, {
        providers: callbacks.providers,
        activeProvider: callbacks.activeProvider,
        onAddProvider: (
          provider: {
            name: string;
            type: string;
            baseUrl: string;
            apiKey?: string;
          },
          model: string,
        ) => {
          addProvider(provider as ProviderConfig);
          callbacks.setActiveProvider(provider.name);
          callbacks.setActiveModel(model);
          callbacks.onComplete(
            ok(
              `Added provider "${provider.name}" and switched to ${provider.name}/${model}.`,
            ),
          );
        },
        onRemoveProvider: (name: string) => {
          removeProvider(name);
          callbacks.reloadProviders();
          callbacks.onComplete(ok(`Removed provider "${name}".`));
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(provider);
