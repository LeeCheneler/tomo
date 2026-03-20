// Register built-in commands
import "./context";
import "./help";
import "./models";
import "./new";
import "./session";
import "./use";

// Re-export registry functions
export { parse, getCommand, getAllCommands } from "./registry";
