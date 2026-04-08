import type { z } from "zod";
import type { Permissions } from "../config/schema";

/** Status of a tool execution result. */
export type ToolResultStatus = "ok" | "error" | "denied";

/** Display format for tool output in the chat list. */
export type ToolResultFormat = "plain" | "diff";

/** Structured result returned by a tool's execute function. */
export interface ToolResult {
  output: string;
  status: ToolResultStatus;
  format: ToolResultFormat;
}

/** Creates a successful tool result with plain text output. */
export function ok(output: string): ToolResult {
  return { output, status: "ok", format: "plain" };
}

/** Creates a successful tool result with diff-formatted output. */
export function okDiff(output: string): ToolResult {
  return { output, status: "ok", format: "diff" };
}

/** Creates an error tool result. */
export function err(output: string): ToolResult {
  return { output, status: "error", format: "plain" };
}

/** Creates a denied tool result (user rejected the action). */
export function denied(output: string): ToolResult {
  return { output, status: "denied", format: "plain" };
}

/** Options for the confirmation prompt. */
export interface ConfirmOptions {
  /** Diff output to display above the approval prompt. */
  diff?: string;
  /** Short label identifying the action type (e.g. "Run Command", "Edit File"). */
  label?: string;
  /** Detail text for the action (e.g. the command string, file path). */
  detail?: string;
}

/** Context provided to a tool's execute function. */
export interface ToolContext {
  /** Resolved file access permissions from config. */
  permissions: Permissions;
  /** Auto-approved command patterns from config (e.g. "git:*", "npm test"). */
  allowedCommands: readonly string[];
  /** Prompts the user for confirmation. Returns true if approved, false if denied. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  /** Prompts the user with a question. Returns the answer, or null if the user cancels. */
  ask: (question: string, options?: string[]) => Promise<string | null>;
  /** Tavily API key for web search, if configured. */
  webSearchApiKey?: string;
  /** Reports incremental output during tool execution (for streaming display). */
  onProgress?: (output: string) => void;
  /** Abort signal from the parent conversation. */
  signal: AbortSignal;
}

/** A tool that the LLM can invoke. */
export interface Tool {
  /** Tool name as sent to the LLM (e.g. "read_file"). */
  name: string;
  /** Human-readable display name for the UI (e.g. "Read File"). */
  displayName: string;
  /** Human-readable description for the LLM. */
  description: string;
  /** JSON Schema for the tool's parameters (sent to the LLM). */
  parameters: Record<string, unknown>;
  /** Zod schema for validating parsed arguments at runtime. */
  argsSchema: z.ZodType;
  /** Returns a short summary string for display next to the tool name (e.g. a file path). */
  formatCall: (args: Record<string, unknown>) => string;
  /** Executes the tool with validated arguments. */
  execute: (args: unknown, context: ToolContext) => Promise<ToolResult>;
}

/**
 * Parses and validates tool arguments against a zod schema.
 * Throws with a clean message on failure.
 */
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
