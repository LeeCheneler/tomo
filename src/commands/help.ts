import { getAllCommands, register } from "./registry";
import type { Command } from "./types";

const help: Command = {
  name: "help",
  description: "List available commands",
  execute: () => {
    const commands = getAllCommands();
    const lines = commands.map((cmd) => `  /${cmd.name} — ${cmd.description}`);
    return { output: lines.join("\n") };
  },
};

register(help);
