import type { ToolDefinition } from "../provider/client";
import type { Tool } from "./types";
import { toToolDefinition } from "./types";

const tools = new Map<string, Tool>();

/** Adds a tool to the registry. */
export function registerTool(tool: Tool): void {
  tools.set(tool.name, tool);
}

/** Returns a registered tool by name, or undefined if not found. */
export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

/** Returns all registered tools. */
export function getAllTools(): Tool[] {
  return [...tools.values()];
}

/** Returns all registered tools as OpenAI tool definitions for the API request. */
export function getToolDefinitions(): ToolDefinition[] {
  return getAllTools().map(toToolDefinition);
}
