// Register built-in tools
import "./ask";
import "./read-file";
import "./run-command";

// Re-export registry functions
export {
  registerTool,
  getTool,
  getAllTools,
  getToolDefinitions,
} from "./registry";
export type { Tool, ToolContext } from "./types";
