import { existsSync, readdirSync, readFileSync } from "node:fs";
import { arch, homedir, platform, release, userInfo } from "node:os";
import { resolve } from "node:path";
import { env } from "./env";

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

/** Builds a system info header with OS, shell, and architecture. */
export function getSystemInfo(): string {
  const os = platform();
  const osRelease = release();
  const shell = env.getOptional("SHELL") ?? "unknown";
  const cwd = process.cwd();
  const username = userInfo().username;
  return `System: ${os} (${osRelease}), arch: ${arch()}, shell: ${shell}, user: ${username}, cwd: ${cwd}`;
}

/**
 * Loads and combines instruction files from root and local locations.
 * If a local file is found, only its matching filename is searched at root.
 * If no local file exists, root is searched with full preference order.
 * Prepends system info header to the result.
 */
export function loadInstructions(): string | null {
  const systemInfo = getSystemInfo();
  const home = homedir();
  const cwd = process.cwd();

  const rootDirs = SEARCH_DIRS(home);
  const localDirs = SEARCH_DIRS(cwd);

  const local = findAcrossDirs(localDirs);

  if (local) {
    const root = findSpecificAcrossDirs(rootDirs, local.filename);
    if (root) return `${systemInfo}\n\n${root}\n\n---\n\n${local.content}`;
    return `${systemInfo}\n\n${local.content}`;
  }

  const root = findAcrossDirs(rootDirs);
  if (root) return `${systemInfo}\n\n${root.content}`;
  return systemInfo;
}
