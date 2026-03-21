import type { ToolDefinition } from "../provider/client";

/** A model-initiated tool with a name, description, parameters, and execute handler. */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: string) => Promise<string>;
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
