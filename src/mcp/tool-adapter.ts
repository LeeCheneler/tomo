import { z } from "zod";
import type { Tool, ToolContext } from "../tools/types";
import { err, ok } from "../tools/types";
import type { McpToolDefinition } from "./client";
import type { McpManager } from "./manager";

/** Prefix used to namespace MCP tool names: `mcp__<server>__<tool>`. */
export const MCP_TOOL_PREFIX = "mcp__";

/** Separator between the prefix, server name, and tool name. */
const NAMESPACE_SEP = "__";

/** Builds the namespaced tool name from a server name and a remote tool name. */
export function encodeMcpToolName(
  serverName: string,
  toolName: string,
): string {
  return `${MCP_TOOL_PREFIX}${serverName}${NAMESPACE_SEP}${toolName}`;
}

/** Returns true if the given tool name is namespaced as an MCP tool. */
export function isMcpToolName(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}

/** Renders a one-line summary of an MCP tool call's args for the chat UI. */
function formatMcpCall(args: Record<string, unknown>): string {
  const entries = Object.entries(args);
  if (entries.length === 0) return "";
  return entries
    .map(([key, value]) => `${key}=${formatValue(value)}`)
    .join(", ");
}

/** Renders a single arg value, truncating long strings and stringifying objects. */
function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value.length > 40 ? `${value.slice(0, 37)}...` : value;
  }
  if (value === null || value === undefined) return String(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

/** Schema accepting any object — MCP servers validate args themselves. */
const passthroughArgsSchema = z.record(z.string(), z.unknown());

/**
 * Wraps an MCP-discovered tool as a tomo Tool that dispatches to the manager.
 *
 * Args are passed straight through to the server with no client-side
 * validation — the MCP server is the source of truth for its own input shape.
 */
export function createMcpTool(
  serverName: string,
  definition: McpToolDefinition,
  manager: McpManager,
): Tool {
  const name = encodeMcpToolName(serverName, definition.name);
  return {
    name,
    displayName: `${serverName}/${definition.name}`,
    description: definition.description ?? `MCP tool from ${serverName}`,
    parameters: definition.inputSchema,
    argsSchema: passthroughArgsSchema,
    formatCall(args) {
      return formatMcpCall(args);
    },
    async execute(args: unknown, context: ToolContext) {
      if (context.signal.aborted) {
        return err("Aborted");
      }
      const client = manager.getClient(serverName);
      if (!client) {
        return err(`MCP server "${serverName}" is not connected`);
      }
      const parsed = passthroughArgsSchema.safeParse(args);
      if (!parsed.success) {
        return err(`Invalid arguments: ${parsed.error.issues[0]?.message}`);
      }
      try {
        const result = await client.callTool(
          definition.name,
          parsed.data,
          context.signal,
        );
        if (result.isError) return err(result.text);
        return ok(result.text);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        return err(message);
      }
    },
  };
}
