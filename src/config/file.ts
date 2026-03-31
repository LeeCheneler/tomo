import { homedir } from "node:os";
import { resolve } from "node:path";

/** Path to the global config file (~/.tomo/config.yaml). */
export const GLOBAL_CONFIG_PATH = resolve(homedir(), ".tomo", "config.yaml");

/** Path to the local config file (.tomo/config.yaml in cwd). */
export const LOCAL_CONFIG_PATH = resolve(process.cwd(), ".tomo", "config.yaml");
