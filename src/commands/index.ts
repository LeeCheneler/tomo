// Register built-in commands
import "./help";
import "./new";

// Re-export registry functions
export { parse, getCommand, getAllCommands } from "./registry";
