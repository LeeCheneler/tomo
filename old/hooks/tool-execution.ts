import chalk from "chalk";
import type { DisplayMessage } from "../components/message-list";
import { getErrorMessage } from "../errors";
import type { McpManager } from "../mcp/manager";
import type { ToolCall } from "../provider/client";
import { getTool, getToolDisplayName, type ToolContext } from "../tools";
import {
  err,
  ok,
  type ToolResult,
  type ToolResultStatus,
} from "../tools/types";

export class ToolDismissedError extends Error {
  constructor() {
    super("The user dismissed the question.");
  }
}

const MAX_ARG_VALUE_LENGTH = 60;

/**
 * Maximum character length for a tool result. Results exceeding this are
 * truncated to head + tail with an indicator in the middle.
 */
const MAX_RESULT_LENGTH = 30_000;
const TRUNCATION_HEAD = 20_000;
const TRUNCATION_TAIL = 10_000;

/** Truncates a string to a max length with ellipsis. */
function truncateValue(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Truncates a tool result to head + tail with an indicator if it exceeds the max length. */
export function truncateResult(result: string): string {
  if (result.length <= MAX_RESULT_LENGTH) return result;
  const omitted = result.length - TRUNCATION_HEAD - TRUNCATION_TAIL;
  const head = result.slice(0, TRUNCATION_HEAD);
  const tail = result.slice(-TRUNCATION_TAIL);
  return `${head}\n\n[output truncated — ${omitted.toLocaleString()} chars omitted]\n\n${tail}`;
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

/** Formats a tool call header: bold name coloured by status + dim args summary. */
export function formatToolHeader(
  name: string,
  args: string,
  status: ToolResultStatus = "ok",
): string {
  let argsSummary = "";
  try {
    const parsed = JSON.parse(args);
    argsSummary = Object.entries(parsed)
      .map(([k, v]) => `${k}: ${formatArgValue(v)}`)
      .join(", ");
  } catch {
    // Malformed args — skip summary
  }
  const colorMap = {
    ok: chalk.bold.yellow,
    error: chalk.bold.red,
    denied: chalk.bold.dim,
  };
  const coloredName = colorMap[status](name);
  return argsSummary
    ? `${coloredName}  ${chalk.dim(argsSummary)}`
    : coloredName;
}

/** Execute a single tool call and return a tool result message. */
async function executeSingleToolCall(
  tc: ToolCall,
  toolContext: ToolContext,
  mcpManager?: McpManager,
  toolAvailability?: Record<string, boolean>,
): Promise<DisplayMessage> {
  let result: ToolResult;

  if (mcpManager?.isMcpTool(tc.function.name)) {
    if (toolAvailability?.[tc.function.name] === false) {
      result = err("This MCP tool has been disabled.");
    } else {
      try {
        const args = JSON.parse(tc.function.arguments || "{}");
        result = ok(await mcpManager.callTool(tc.function.name, args));
      } catch (e) {
        result = err(getErrorMessage(e));
      }
    }
  } else if (tc.function.name.startsWith("mcp__")) {
    result = err(
      "This MCP tool is no longer available. The server has been disabled.",
    );
  } else {
    const tool = getTool(tc.function.name);
    if (!tool) {
      result = err(`unknown tool "${tc.function.name}"`);
    } else {
      try {
        result = await tool.execute(tc.function.arguments, toolContext);
      } catch (e) {
        if (e instanceof ToolDismissedError) throw e;
        result = err(getErrorMessage(e));
      }
    }
  }

  const header = formatToolHeader(
    getToolDisplayName(tc.function.name),
    tc.function.arguments,
    result.status,
  );
  return {
    id: crypto.randomUUID(),
    role: "tool",
    content: `${header}\n${truncateResult(result.output)}`,
    tool_call_id: tc.id,
  };
}

/** Executes tool calls. Non-interactive tools run in parallel, interactive ones run sequentially. */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  signal: AbortSignal,
  toolContext: ToolContext,
  mcpManager?: McpManager,
  toolAvailability?: Record<string, boolean>,
): Promise<DisplayMessage[]> {
  // Separate into non-interactive (can run in parallel) and interactive (must be sequential).
  // MCP tools are always non-interactive — access is controlled via tool availability in settings.
  const nonInteractive: ToolCall[] = [];
  const interactive: ToolCall[] = [];

  for (const tc of toolCalls) {
    if (
      mcpManager?.isMcpTool(tc.function.name) ||
      tc.function.name.startsWith("mcp__")
    ) {
      nonInteractive.push(tc);
    } else {
      const tool = getTool(tc.function.name);
      if (tool && tool.interactive === false) {
        nonInteractive.push(tc);
      } else {
        interactive.push(tc);
      }
    }
  }

  // Run non-interactive tools in parallel.
  const parallelResults =
    nonInteractive.length > 0
      ? await Promise.all(
          nonInteractive.map((tc) =>
            executeSingleToolCall(
              tc,
              toolContext,
              mcpManager,
              toolAvailability,
            ),
          ),
        )
      : [];

  // Run interactive tools sequentially.
  const sequentialResults: DisplayMessage[] = [];
  for (const tc of interactive) {
    if (signal.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    sequentialResults.push(
      await executeSingleToolCall(
        tc,
        toolContext,
        mcpManager,
        toolAvailability,
      ),
    );
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
