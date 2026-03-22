import type { ReactElement } from "react";
import type { ToolDefinition } from "../provider/client";

/** Context provided to a tool's execute function. */
export interface ToolContext {
  /** Render an interactive component and await the user's response. */
  renderInteractive: (
    factory: (
      onResult: (result: string) => void,
      onCancel: () => void,
    ) => ReactElement,
  ) => Promise<string>;
  /** Report partial output to the UI during long-running operations. */
  reportProgress: (content: string) => void;
  /** Resolved tool permissions from config. */
  permissions: Record<string, boolean>;
}

/** A model-initiated tool with a name, description, parameters, and execute handler. */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Whether the tool requires user interaction (confirmation, input). Defaults to true. */
  interactive?: boolean;
  /** Whether the tool is enabled by default. Defaults to true. */
  enabled?: boolean;
  execute: (args: string, context: ToolContext) => Promise<string>;
}

/** Converts a Tool to the OpenAI tool definition format for the API request. */
export function toToolDefinition(tool: Tool): ToolDefinition {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
