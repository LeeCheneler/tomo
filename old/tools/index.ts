// Register built-in tools
import "./agent";
import "./ask";
import "./edit-file";
import "./glob";
import "./grep";
import "./read-file";
import "./run-command";
import "./skill";
import "./web-search";
import "./write-file";

// Re-export registry functions
export {
  getAllTools,
  getTool,
  getToolDefinitions,
  getToolDisplayName,
  registerTool,
  resolveToolAvailability,
} from "./registry";
export type { Tool, ToolContext } from "./types";
