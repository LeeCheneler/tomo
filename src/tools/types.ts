import type { ReactElement } from "react";
import type { z } from "zod";
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
  /** Returns a warning message when the tool is enabled but misconfigured, or undefined if OK. */
  warning?: () => string | undefined;
  execute: (args: string, context: ToolContext) => Promise<string>;
}

/** Parse and validate tool arguments against a Zod schema. Throws with a clean message on failure. */
export function parseToolArgs<T extends z.ZodType>(
  schema: T,
  args: string,
): z.infer<T> {
  const json = JSON.parse(args);
  const result = schema.safeParse(json);
  if (!result.success) {
    const messages = result.error.issues.map((i) => i.message);
    throw new Error(messages.join("; "));
  }
  return result.data;
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
