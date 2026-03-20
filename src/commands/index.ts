// Register built-in commands
import "./help";
import "./models";
import "./new";

// Re-export registry functions
export { parse, getCommand, getAllCommands } from "./registry";
