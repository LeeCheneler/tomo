import { homedir } from "node:os";
import { resolve } from "node:path";
import { fileExists, readFile } from "../utils/fs";

/** Returns the global instruction file path (~/tomo.md). */
function globalInstructionPath(): string {
  return resolve(homedir(), "tomo.md");
}

/** Returns the local instruction file path (.tomo/tomo.md in cwd). */
function localInstructionPath(): string {
  return resolve(process.cwd(), ".tomo", "tomo.md");
}

/**
 * Reads file content, returns null if the file doesn't exist or is empty/whitespace.
 */
function readContent(path: string): string | null {
  if (!fileExists(path)) return null;
  const content = readFile(path).trim();
  return content || null;
}

/**
 * Loads user instruction files from global (~/tomo.md) and local (.tomo/tomo.md).
 * Returns null if neither file exists. When both exist, they are joined with a separator.
 */
export function loadInstructions(): string | null {
  const global = readContent(globalInstructionPath());
  const local = readContent(localInstructionPath());

  if (!global && !local) return null;

  const parts: string[] = [];
  if (global) parts.push(global);
  if (global && local) parts.push("---");
  if (local) parts.push(local);

  return parts.join("\n\n");
}
