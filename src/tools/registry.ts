import type { ToolDefinition } from "../provider/client";
import type { Tool } from "./types";

/** Registry for managing available tools. */
export interface ToolRegistry {
  /** Registers a tool. Overwrites if the name already exists. */
  register: (tool: Tool) => void;
  /** Returns a tool by name, or undefined if not found. */
  get: (name: string) => Tool | undefined;
  /** Returns all registered tools. */
  list: () => readonly Tool[];
  /** Returns OpenAI-compatible tool definitions for the LLM API. */
  getDefinitions: () => ToolDefinition[];
}

/** Creates a new tool registry. */
export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, Tool>();

  return {
    register(tool: Tool) {
      tools.set(tool.name, tool);
    },
    get(name: string) {
      return tools.get(name);
    },
    list() {
      return [...tools.values()];
    },
    getDefinitions() {
      return [...tools.values()].map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    },
  };
}
