import type { ReactElement } from "react";

/** Output returned by a command to display as a system message. */
export interface CommandResult {
  output: string;
}

/** Either an immediate result or an interactive element that takes over input. */
export type CommandExecuteResult =
  | CommandResult
  | { interactive: ReactElement };

/** Context and callbacks provided to commands for state changes and provider access. */
export interface CommandCallbacks {
  onComplete: (result: CommandResult) => void;
  onCancel: () => void;
  clearMessages: () => void;
  setActiveModel: (model: string) => void;
  providerBaseUrl: string;
  activeModel: string;
}

/** A registered slash command with a name, description, and execute handler. */
export interface Command {
  name: string;
  description: string;
  execute: (
    args: string,
    callbacks: CommandCallbacks,
  ) => CommandExecuteResult | Promise<CommandExecuteResult>;
}
