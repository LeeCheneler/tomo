import chalk from "chalk";
import type { DisplayMessage } from "../components/message-list";
import type { ToolCall } from "../provider/client";
import { type ToolContext, getTool, getToolDisplayName } from "../tools";

export class ToolDismissedError extends Error {
  constructor() {
    super("The user dismissed the question.");
  }
}

const MAX_ARG_VALUE_LENGTH = 60;

/** Truncates a string to a max length with ellipsis. */
function truncateValue(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Formats a single arg value for display. */
function formatArgValue(value: unknown): string {
  if (typeof value === "string") {
    return truncateValue(value, MAX_ARG_VALUE_LENGTH);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  return truncateValue(JSON.stringify(value), MAX_ARG_VALUE_LENGTH);
}

/** Formats a tool call header: bold yellow name + dim args summary. */
export function formatToolHeader(name: string, args: string): string {
  let argsSummary = "";
  try {
    const parsed = JSON.parse(args);
    argsSummary = Object.entries(parsed)
      .map(([k, v]) => `${k}: ${formatArgValue(v)}`)
      .join(", ");
  } catch {
    // Malformed args — skip summary
  }
  const header = argsSummary
    ? `${chalk.bold.yellow(name)}  ${chalk.dim(argsSummary)}`
    : chalk.bold.yellow(name);
  return header;
}

/** Execute a single tool call and return a tool result message. */
async function executeSingleToolCall(
  tc: ToolCall,
  toolContext: ToolContext,
): Promise<DisplayMessage> {
  const tool = getTool(tc.function.name);
  let result: string;
  if (!tool) {
    result = `Error: unknown tool "${tc.function.name}"`;
  } else {
    try {
      result = await tool.execute(tc.function.arguments, toolContext);
    } catch (err) {
      if (err instanceof ToolDismissedError) throw err;
      result = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const header = formatToolHeader(
    getToolDisplayName(tc.function.name),
    tc.function.arguments,
  );
  return {
    id: crypto.randomUUID(),
    role: "tool",
    content: `${header}\n${result}`,
    tool_call_id: tc.id,
  };
}

/** Executes tool calls. Non-interactive tools run in parallel, interactive ones run sequentially. */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  signal: AbortSignal,
  toolContext: ToolContext,
): Promise<DisplayMessage[]> {
  // Separate into non-interactive (can run in parallel) and interactive (must be sequential).
  const nonInteractive: ToolCall[] = [];
  const interactive: ToolCall[] = [];

  for (const tc of toolCalls) {
    const tool = getTool(tc.function.name);
    if (tool && tool.interactive === false) {
      nonInteractive.push(tc);
    } else {
      interactive.push(tc);
    }
  }

  // Run non-interactive tools in parallel.
  const parallelResults =
    nonInteractive.length > 0
      ? await Promise.all(
          nonInteractive.map((tc) => executeSingleToolCall(tc, toolContext)),
        )
      : [];

  // Run interactive tools sequentially.
  const sequentialResults: DisplayMessage[] = [];
  for (const tc of interactive) {
    if (signal.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    sequentialResults.push(await executeSingleToolCall(tc, toolContext));
  }

  // Return results in the original tool call order.
  const allResults = [...parallelResults, ...sequentialResults];
  const resultByCallId = new Map<string, DisplayMessage>();
  for (const msg of allResults) {
    if (msg.role === "tool") {
      resultByCallId.set(msg.tool_call_id, msg);
    }
  }
  return toolCalls.map((tc) => resultByCallId.get(tc.id) as DisplayMessage);
}
