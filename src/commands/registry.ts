import chalk from "chalk";
import type { ReactNode } from "react";
import { theme } from "../ui/theme";

/** Callback for a takeover component to signal completion. */
export type TakeoverDone = (result?: string) => void;

/** Renders takeover content given a done callback and runtime context. */
export type TakeoverRender = (
  onDone: TakeoverDone,
  context: CommandContext,
) => ReactNode;

/** Runtime context passed to handler commands when invoked. */
export interface CommandContext {
  /** Token usage from the last completion, or null if none yet. */
  usage: { promptTokens: number; completionTokens: number } | null;
  /** Context window size for the active model. */
  contextWindow: number;
  /** Clears the current conversation and starts a new session file. */
  resetSession: () => void;
  /** Loads a saved session, replacing current messages and session file. */
  loadSession: (path: string) => void;
}

/** Fields shared by all command types. */
interface CommandBase {
  name: string;
  description: string;
}

/** A command that returns a string result. */
interface HandlerCommand extends CommandBase {
  handler: (context: CommandContext) => string | Promise<string>;
  takeover?: never;
}

/** A command that takes over the screen. */
interface TakeoverCommand extends CommandBase {
  handler?: never;
  takeover: TakeoverRender;
}

/** Defines a slash command — either a handler or a takeover, never both. */
export type CommandDefinition = HandlerCommand | TakeoverCommand;

/** Result of invoking a command that produces inline output. */
interface InlineResult {
  name: string;
  type: "inline";
  output: string;
}

/** Result of invoking a command that takes over the screen. */
interface TakeoverResult {
  name: string;
  type: "takeover";
  render: TakeoverRender;
}

/** Result of invoking a command. Discriminate on `type`. */
export type InvokeResult = InlineResult | TakeoverResult;

/** Registry for looking up and listing commands. */
export interface CommandRegistry {
  /** Registers a command. Overwrites if the name already exists. */
  register: (command: CommandDefinition) => void;
  /** Returns a command by name, or undefined if not found. */
  get: (name: string) => CommandDefinition | undefined;
  /** Returns all registered commands in registration order. */
  list: () => readonly CommandDefinition[];
  /** Parses and invokes a slash command input with runtime context. */
  invoke: (input: string, context: CommandContext) => Promise<InvokeResult>;
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
    async invoke(input: string, context: CommandContext) {
      const name = parseCommandName(input);
      const command = commands.get(name);

      if (command?.takeover) {
        return { name, type: "takeover" as const, render: command.takeover };
      }

      if (command?.handler) {
        const output = await command.handler(context);
        return { name, type: "inline" as const, output };
      }

      return {
        name,
        type: "inline" as const,
        output: chalk[theme.error](`Unknown command: /${name}`),
      };
    },
  };
}
