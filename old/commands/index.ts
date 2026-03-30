// Register built-in commands
import "./context";
import "./help";
import "./model";
import "./new";
import "./provider";
import "./session";
import "./settings";
import "./skills";

// Re-export registry functions
export { getAllCommands, getCommand, parse } from "./registry";
