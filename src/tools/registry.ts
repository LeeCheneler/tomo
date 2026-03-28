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

/** Returns the display name for a tool, falling back to the raw name. */
export function getToolDisplayName(name: string): string {
  return tools.get(name)?.displayName ?? name;
}

/**
 * Resolves which tools are enabled. Config overrides take priority,
 * then the tool's own `enabled` default, then true.
 * Returns a map of tool name → boolean.
 */
export function resolveToolAvailability(
  config?: Record<string, boolean>,
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const tool of getAllTools()) {
    result[tool.name] = config?.[tool.name] ?? tool.enabled ?? true;
  }
  return result;
}

/** Returns enabled tools as OpenAI tool definitions for the API request. */
export function getToolDefinitions(
  availability?: Record<string, boolean>,
): ToolDefinition[] {
  const all = getAllTools();
  if (!availability) return all.map(toToolDefinition);
  return all
    .filter((t) => availability[t.name] !== false)
    .map(toToolDefinition);
}
