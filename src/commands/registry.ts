/** Defines a slash command. */
export interface CommandDefinition {
  name: string;
  description: string;
  handler: () => string;
}

/** Registry for looking up and listing commands. */
export interface CommandRegistry {
  /** Registers a command. Overwrites if the name already exists. */
  register: (command: CommandDefinition) => void;
  /** Returns a command by name, or undefined if not found. */
  get: (name: string) => CommandDefinition | undefined;
  /** Returns all registered commands in registration order. */
  list: () => readonly CommandDefinition[];
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
  };
}
