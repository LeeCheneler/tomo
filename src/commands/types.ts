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
  switchSession: (id: string) => string | null;
  setActiveModel: (model: string) => void;
  setActiveProvider: (name: string) => string | null;
  providerBaseUrl: string;
  activeModel: string;
  activeProvider: string;
  providerNames: string[];
  contextWindow: number;
  maxTokens: number;
  tokenUsage: { promptTokens: number; completionTokens: number } | null;
  messageCount: number;
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
