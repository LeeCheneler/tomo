// Register built-in commands
import "./context";
import "./grant";
import "./help";
import "./model";
import "./new";
import "./session";
import "./skills";
import "./tools";

// Re-export registry functions
export { parse, getCommand, getAllCommands } from "./registry";
