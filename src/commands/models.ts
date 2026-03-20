import { fetchModels } from "../provider/client";
import { register } from "./registry";
import type { Command } from "./types";

const models: Command = {
  name: "models",
  description: "List available models from the active provider",
  execute: async (_args, { providerBaseUrl, activeModel }) => {
    try {
      const available = await fetchModels(providerBaseUrl);
      if (available.length === 0) {
        return { output: "No models available from the active provider." };
      }
      const lines = available.map((m) =>
        m.id === activeModel ? `  * ${m.id} (active)` : `    ${m.id}`,
      );
      return { output: lines.join("\n") };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { output: `Failed to fetch models: ${message}` };
    }
  },
};

register(models);
