import chalk from "chalk";
import { getAllCommands, register } from "./registry";
import type { Command } from "./types";

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

const help: Command = {
  name: "help",
  description: "List available commands",
  execute: () => {
    const commands = getAllCommands();
    const maxName = Math.max(...commands.map((cmd) => cmd.name.length));
    const lines = commands.map(
      (cmd) =>
        `  ${chalk.bold.cyan(cmd.name.padEnd(maxName))}  ${chalk.dim(truncate(cmd.description, 50))}`,
    );
    return { output: `Available commands:\n \n${lines.join("\n")}` };
  },
};

register(help);
