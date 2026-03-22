// Register built-in tools
import "./ask";
import "./edit-file";
import "./glob";
import "./grep";
import "./read-file";
import "./run-command";
import "./write-file";

// Re-export registry functions
export {
  registerTool,
  getTool,
  getAllTools,
  getToolDefinitions,
  resolveToolAvailability,
} from "./registry";
export type { Tool, ToolContext } from "./types";
