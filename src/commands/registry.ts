import type { Command } from "./types";

const commands = new Map<string, Command>();

/** Adds a command to the registry. */
export function register(command: Command): void {
  commands.set(command.name, command);
}

/** Extracts command name and args from slash input. Returns null for non-commands. */
export function parse(input: string): { name: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { name: trimmed.slice(1), args: "" };
  }

  return {
    name: trimmed.slice(1, spaceIndex),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/** Returns a registered command by name, or undefined if not found. */
export function getCommand(name: string): Command | undefined {
  return commands.get(name);
}

/** Returns all registered commands. */
export function getAllCommands(): Command[] {
  return [...commands.values()];
}
