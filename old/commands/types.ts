import type { ReactElement } from "react";
import type { ToolResult } from "../tools/types";

/** Either an immediate result or an interactive element that takes over input. */
export type CommandExecuteResult = ToolResult | { interactive: ReactElement };

/** Context and callbacks provided to commands for state changes and provider access. */
export interface CommandCallbacks {
  onComplete: (result: ToolResult) => void;
  onCancel: () => void;
  clearMessages: () => void;
  switchSession: (id: string) => string | null;
  setActiveModel: (model: string) => void;
  setActiveProvider: (name: string) => string | null;
  reloadProviders: () => void;
  providerBaseUrl: string;
  activeModel: string;
  activeProvider: string;
  providers: Array<{ name: string; baseUrl: string; type: string }>;
  contextWindow: number;
  maxTokens: number;
  tokenUsage: { promptTokens: number; completionTokens: number } | null;
  messageCount: number;
  mcpFailedServers: string[];
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
