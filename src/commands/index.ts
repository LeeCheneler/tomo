// Register built-in commands
import "./context";
import "./grant";
import "./help";
import "./models";
import "./new";
import "./session";
import "./tools";
import "./use";

// Re-export registry functions
export { parse, getCommand, getAllCommands } from "./registry";
