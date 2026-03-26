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
        `  ${chalk.bold.cyan(`/${cmd.name}`.padEnd(maxName + 1))}  ${chalk.dim(truncate(cmd.description, 50))}`,
    );

    const sections = [
      `${chalk.bold("Commands:")}\n \n${lines.join("\n")}`,
      `${chalk.bold("Skills:")}\n \n  Type ${chalk.cyan("//skill-name")} to invoke a skill. Use ${chalk.cyan("/skills")} to list available skills.`,
      `${chalk.bold("Images:")}\n \n  ${chalk.cyan("Cmd+V")}   Paste an image file path (e.g. copied from Finder).\n  ${chalk.cyan("Ctrl+V")}  Paste an image from the clipboard (e.g. a screenshot).\n  Use ${chalk.cyan("↓")} to enter image navigation, ${chalk.cyan("← →")} to select, ${chalk.cyan("Backspace")} to remove.`,
      `${chalk.bold("Tips:")}\n \n  Press ${chalk.cyan("Tab")} to expand the full conversation in your system pager (e.g. ${chalk.cyan("less")}).\n  Commands ${chalk.cyan("/")} control the app. Skills ${chalk.cyan("//")} inject instructions into the conversation.`,
    ];

    return { output: sections.join("\n \n") };
  },
};

register(help);
