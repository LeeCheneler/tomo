import chalk from "chalk";
import { getAllTools } from "../tools";
import { register } from "./registry";
import type { Command } from "./types";

const tools: Command = {
  name: "tools",
  description: "List available tools",
  execute: () => {
    const all = getAllTools();
    if (all.length === 0) {
      return { output: "No tools available." };
    }
    const lines = all.map(
      (t) => `  ${chalk.bold.yellow(t.name)} — ${t.description}`,
    );
    return { output: lines.join("\n") };
  },
};

register(tools);
