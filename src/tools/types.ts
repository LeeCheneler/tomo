import type { z } from "zod";
import type { Permissions } from "../config/schema";

/** Status of a tool execution result. */
export type ToolResultStatus = "ok" | "error" | "denied";

/** Structured result returned by a tool's execute function. */
export interface ToolResult {
  output: string;
  status: ToolResultStatus;
}

/** Creates a successful tool result. */
export function ok(output: string): ToolResult {
  return { output, status: "ok" };
}

/** Creates an error tool result. */
export function err(output: string): ToolResult {
  return { output, status: "error" };
}

/** Creates a denied tool result (user rejected the action). */
export function denied(output: string): ToolResult {
  return { output, status: "denied" };
}

/** Context provided to a tool's execute function. */
export interface ToolContext {
  /** Resolved file access permissions from config. */
  permissions: Permissions;
  /** Prompts the user for confirmation. Returns true if approved, false if denied. */
  confirm: (message: string) => Promise<boolean>;
  /** Abort signal from the parent conversation. */
  signal: AbortSignal;
}

/** A tool that the LLM can invoke. */
export interface Tool {
  /** Tool name as sent to the LLM (e.g. "read_file"). */
  name: string;
  /** Human-readable description for the LLM. */
  description: string;
  /** JSON Schema for the tool's parameters (sent to the LLM). */
  parameters: Record<string, unknown>;
  /** Zod schema for validating parsed arguments at runtime. */
  argsSchema: z.ZodType;
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
