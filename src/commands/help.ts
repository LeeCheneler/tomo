import chalk from "chalk";
import type { CommandDefinition, CommandRegistry } from "./registry";

/** Pads a command name (with leading slash) to a fixed width for alignment. */
function padName(name: string, width: number): string {
  return `/${name}`.padEnd(width + 1);
}

/** Formats the Commands section listing every registered command. */
function formatCommands(commands: readonly CommandDefinition[]): string {
  const maxName = Math.max(...commands.map((c) => c.name.length));
  const lines = commands.map(
    (cmd) =>
      `  ${chalk.cyan(padName(cmd.name, maxName))}  ${chalk.dim(cmd.description)}`,
  );
  return `${chalk.bold("Commands:")}\n\n${lines.join("\n")}`;
}

/** Formats the Skills section explaining how to invoke skills. */
function formatSkills(): string {
  return `${chalk.bold("Skills:")}\n\n  Type ${chalk.cyan("//")} to browse available skills, then ${chalk.cyan("//skill-name")} to invoke one.`;
}

/** Formats the Images section listing image-related keybindings. */
function formatImages(): string {
  const lines = [
    `  ${chalk.cyan("Cmd+V")}    Paste an image file path (e.g. copied from Finder).`,
    `  ${chalk.cyan("Ctrl+V")}   Paste an image from the clipboard (e.g. a screenshot).`,
    `  Use ${chalk.cyan("↓")} to enter image navigation, ${chalk.cyan("← →")} to select, ${chalk.cyan("Backspace")} to remove.`,
  ];
  return `${chalk.bold("Images:")}\n\n${lines.join("\n")}`;
}

/** Formats the Tips section with usage hints. */
function formatTips(): string {
  const lines = [
    `  Press ${chalk.cyan("Tab")} to view the full conversation in your system pager (e.g. ${chalk.cyan("less")}).`,
    `  Commands ${chalk.cyan("/")} control the app. Skills ${chalk.cyan("//")} inject instructions into the conversation.`,
  ];
  return `${chalk.bold("Tips:")}\n\n${lines.join("\n")}`;
}

/** Builds the full help text from a list of registered commands. */
export function formatHelp(commands: readonly CommandDefinition[]): string {
  return [
    formatCommands(commands),
    formatSkills(),
    formatImages(),
    formatTips(),
  ].join("\n\n");
}

/** Creates a /help command that lists all commands registered in the given registry. */
export function createHelpCommand(
  registry: CommandRegistry,
): CommandDefinition {
  return {
    name: "help",
    description: "List available commands",
    handler: () => formatHelp(registry.list()),
  };
}
