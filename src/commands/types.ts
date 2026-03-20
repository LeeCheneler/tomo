import type { ReactElement } from "react";

/** Output returned by a command to display as a system message. */
export interface CommandResult {
  output: string;
}

/** Either an immediate result or an interactive element that takes over input. */
export type CommandExecuteResult =
  | CommandResult
  | { interactive: ReactElement };

/** Callbacks provided to interactive commands for completion and cancellation. */
export interface InteractiveCallbacks {
  onComplete: (result: CommandResult) => void;
  onCancel: () => void;
}

/** A registered slash command with a name, description, and execute handler. */
export interface Command {
  name: string;
  description: string;
  execute: (
    args: string,
    callbacks: InteractiveCallbacks,
  ) => CommandExecuteResult;
}
