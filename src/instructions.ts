import { existsSync, readdirSync, readFileSync } from "node:fs";
import { arch, homedir, platform, release, userInfo } from "node:os";
import { resolve } from "node:path";
import { env } from "./env";
import {
  getDefaultBranch,
  getGitBranch,
  getGitLog,
  getGitStatusSummary,
  isGhCliAvailable,
  isGitHubRemote,
  isGitRepo,
} from "./git";
import { getAllSkills } from "./skills";

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

/** Builds git context for the system prompt when in a git repo. */
export function getGitContext(): string | null {
  const cwd = process.cwd();
  if (!isGitRepo(cwd)) return null;

  const lines: string[] = [];
  lines.push(`Branch: ${getGitBranch(cwd)}`);
  lines.push(`Default branch: ${getDefaultBranch(cwd)}`);
  lines.push(`Working tree: ${getGitStatusSummary(cwd)}`);

  const log = getGitLog(cwd);
  if (log) {
    lines.push(`\nRecent commits:\n${log}`);
  }

  if (isGitHubRemote(cwd)) {
    const hint = isGhCliAvailable()
      ? "Remote is GitHub. gh CLI is available for PRs, issues, etc."
      : "Remote is GitHub. gh CLI is not installed.";
    lines.push(hint);
  }

  return `Git:\n${lines.join("\n")}`;
}

/**
 * Loads and combines instruction files from root and local locations.
 * If a local file is found, only its matching filename is searched at root.
 * If no local file exists, root is searched with full preference order.
 * Prepends system info header to the result.
 */
export function loadInstructions(): string | null {
  const systemInfo = getSystemInfo();
  const gitContext = getGitContext();
  const header = gitContext ? `${systemInfo}\n\n${gitContext}` : systemInfo;
  const home = homedir();
  const cwd = process.cwd();

  const rootDirs = SEARCH_DIRS(home);
  const localDirs = SEARCH_DIRS(cwd);

  const local = findAcrossDirs(localDirs);

  if (local) {
    const root = findSpecificAcrossDirs(rootDirs, local.filename);
    if (root) return `${header}\n\n${root}\n\n---\n\n${local.content}`;
    return `${header}\n\n${local.content}`;
  }

  const root = findAcrossDirs(rootDirs);
  const base = root ? `${header}\n\n${root.content}` : header;

  return appendSkillsNotice(base);
}

/** Appends a skills notice to the system instructions if any skills are available. */
function appendSkillsNotice(instructions: string): string {
  const skills = getAllSkills();
  if (skills.length === 0) return instructions;

  const list = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  return `${instructions}\n\n## Skills\n\nYou have access to skills — specialized instructions for common tasks. When the user's request matches an available skill, use the skill tool to load its instructions before starting work.\n\nAvailable skills:\n${list}`;
}
