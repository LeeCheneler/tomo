// Register built-in commands
import "./help";
import "./models";
import "./new";
import "./use";

// Re-export registry functions
export { parse, getCommand, getAllCommands } from "./registry";
