import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const FILENAMES = ["claude.md", "agents.md"];

const SEARCH_DIRS = (base: string) => [
  resolve(base, ".tomo"),
  resolve(base, ".claude"),
  base,
];

/** Case-insensitive search for a specific filename in a directory. */
function findFile(dir: string, target: string): string | null {
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir);
  const match = entries.find((e) => e.toLowerCase() === target);
  return match ? resolve(dir, match) : null;
}

/** Case-insensitive search for any instruction file in a directory. */
function findInstructionFile(
  dir: string,
): { path: string; filename: string } | null {
  if (!existsSync(dir)) return null;
  const entries = readdirSync(dir);
  for (const target of FILENAMES) {
    const match = entries.find((e) => e.toLowerCase() === target);
    if (match) return { path: resolve(dir, match), filename: target };
  }
  return null;
}

/** Reads file content, returns null if empty. */
function readContent(path: string): string | null {
  const content = readFileSync(path, "utf-8").trim();
  return content || null;
}

/** Searches directories in order for any instruction file. */
function findAcrossDirs(
  dirs: string[],
): { content: string; filename: string } | null {
  for (const dir of dirs) {
    const found = findInstructionFile(dir);
    if (found) {
      const content = readContent(found.path);
      if (content) return { content, filename: found.filename };
    }
  }
  return null;
}

/** Searches directories in order for a specific filename only. */
function findSpecificAcrossDirs(
  dirs: string[],
  filename: string,
): string | null {
  for (const dir of dirs) {
    const path = findFile(dir, filename);
    if (path) {
      const content = readContent(path);
      if (content) return content;
    }
  }
  return null;
}

/**
 * Loads and combines instruction files from root and local locations.
 * If a local file is found, only its matching filename is searched at root.
 * If no local file exists, root is searched with full preference order.
 */
export function loadInstructions(): string | null {
  const home = homedir();
  const cwd = process.cwd();

  const rootDirs = SEARCH_DIRS(home);
  const localDirs = SEARCH_DIRS(cwd);

  const local = findAcrossDirs(localDirs);

  if (local) {
    const root = findSpecificAcrossDirs(rootDirs, local.filename);
    if (root) return `${root}\n\n---\n\n${local.content}`;
    return local.content;
  }

  const root = findAcrossDirs(rootDirs);
  return root?.content ?? null;
}
