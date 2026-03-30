import type { ReactElement } from "react";
import type { z } from "zod";
import type { ToolDefinition } from "../provider/client";

/** Provider details needed by tools that spawn completion loops (e.g. agent). */
export interface ProviderInfo {
  baseUrl: string;
  model: string;
  apiKey?: string;
  maxTokens: number;
  contextWindow: number;
}

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
  /** Abort signal from the parent conversation. */
  signal: AbortSignal;
  /** Current agent nesting depth. 0 = main conversation. */
  depth: number;
  /** Provider config for spawning sub-agent completion loops. */
  providerConfig: ProviderInfo;
  /** Commands that are auto-approved. Exact strings or "prefix:*" entries. */
  allowedCommands: string[];
}

/** Structured result returned by a tool's execute function. */
export type ToolResultStatus = "ok" | "error" | "denied";

export interface ToolResult {
  output: string;
  status: ToolResultStatus;
}

/** Create a successful tool result. */
export function ok(output: string): ToolResult {
  return { output, status: "ok" };
}

/** Create an error tool result. Displayed with a red header. */
export function err(output: string): ToolResult {
  return { output, status: "error" };
}

/** Create a denied tool result (user rejected the action). Displayed with a dim header. */
export function denied(output: string): ToolResult {
  return { output, status: "denied" };
}

/** A model-initiated tool with a name, description, parameters, and execute handler. */
export interface Tool {
  name: string;
  /** Human-readable display name for the TUI (e.g. "Read File" instead of "read_file"). */
  displayName?: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Whether the tool requires user interaction (confirmation, input). Defaults to true. */
  interactive?: boolean;
  /** Whether the tool is enabled by default. Defaults to true. */
  enabled?: boolean;
  /** Returns a warning message when the tool is enabled but misconfigured, or undefined if OK. */
  warning?: () => string | undefined;
  execute: (args: string, context: ToolContext) => Promise<ToolResult>;
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
