import chalk from "chalk";
import type { CommandMessage } from "../chat/message";
import { theme } from "../ui/theme";

/** Defines a slash command. */
export interface CommandDefinition {
  name: string;
  description: string;
  handler: () => string | Promise<string>;
}

/** Registry for looking up and listing commands. */
export interface CommandRegistry {
  /** Registers a command. Overwrites if the name already exists. */
  register: (command: CommandDefinition) => void;
  /** Returns a command by name, or undefined if not found. */
  get: (name: string) => CommandDefinition | undefined;
  /** Returns all registered commands in registration order. */
  list: () => readonly CommandDefinition[];
  /** Parses and executes a slash command input, returning a CommandMessage. */
  invoke: (input: string) => Promise<CommandMessage>;
}

/** Parses the command name from a slash command input. */
function parseCommandName(input: string): string {
  return input.slice(1).split(" ")[0];
}

/** Creates a new command registry. */
export function createCommandRegistry(): CommandRegistry {
  const commands = new Map<string, CommandDefinition>();

  return {
    register(command: CommandDefinition) {
      commands.set(command.name, command);
    },
    get(name: string) {
      return commands.get(name);
    },
    list() {
      return [...commands.values()];
    },
    async invoke(input: string) {
      const name = parseCommandName(input);
      const command = commands.get(name);
      if (command) {
        const result = await command.handler();
        return {
          id: crypto.randomUUID(),
          role: "command" as const,
          command: name,
          result,
        };
      }
      return {
        id: crypto.randomUUID(),
        role: "command" as const,
        command: name,
        result: chalk[theme.error](`Unknown command: /${name}`),
      };
    },
  };
}
