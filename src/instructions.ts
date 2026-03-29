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

  const toolUsage = getToolUsageGuidance();

  if (local) {
    const root = findSpecificAcrossDirs(rootDirs, local.filename);
    if (root)
      return appendSkillsNotice(
        `${header}\n\n${root}\n\n---\n\n${local.content}\n\n${toolUsage}`,
      );
    return appendSkillsNotice(`${header}\n\n${local.content}\n\n${toolUsage}`);
  }

  const root = findAcrossDirs(rootDirs);
  const base = root
    ? `${header}\n\n${root.content}\n\n${toolUsage}`
    : `${header}\n\n${toolUsage}`;

  return appendSkillsNotice(base);
}

/** Appends a skills notice to the system instructions if any skills are available. */
function appendSkillsNotice(instructions: string): string {
  const skills = getAllSkills();
  if (skills.length === 0) return instructions;

  const list = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  return `${instructions}\n\n## Skills\n\nYou have access to skills — specialized instructions for common tasks. When the user's request matches an available skill, use the skill tool to load its instructions before starting work.\n\nAvailable skills:\n${list}`;
}

/** Returns tool usage guidance for the main agent system prompt. */
function getToolUsageGuidance(): string {
  return `## Using your tools

You have access to tools for reading, writing, searching, and executing commands. Follow these rules to use them effectively.

### Read before you write

You MUST read a file before editing or overwriting it. Do not guess at file contents — read first, then modify. This applies to both edit_file and write_file.

### Use dedicated tools, not shell commands

Do NOT use run_command for tasks that have dedicated tools. Dedicated tools are faster, safer, and produce better-structured output.

- Reading files → use read_file (not cat, head, tail, or less)
- Editing files → use edit_file (not sed, awk, or perl)
- Creating files → use write_file (not echo, printf, or cat heredocs)
- Finding files by name → use glob (not find or ls)
- Searching file contents → use grep (not grep, rg, or git grep)

Reserve run_command for operations that have no dedicated tool: running tests, builds, linters, git commands, and package managers.

### Parallel tool calls

When you need to make multiple tool calls that are independent of each other, make them all in the same response. This runs them in parallel and is significantly faster.

Good candidates for parallel calls:
- Reading multiple files at once
- Running glob and grep searches simultaneously
- Spawning multiple sub-agents for different research topics

Do NOT parallelise calls that depend on each other — if you need the result of one call to inform another, run them sequentially.

### Codebase exploration

Choose your approach based on how many files you will need to examine:

1. **Targeted search** (1-3 files): Use glob or grep directly, then read_file. This is fast and precise.
2. **Broad exploration** (more than 3 files, or you don't know what you need yet): You MUST spawn sub-agents using the agent tool. Do NOT attempt broad exploration with sequential tool calls — it is too slow and fills context.

**When to spawn sub-agents:**
- The user asks to explore, investigate, describe, review, or understand a codebase or large area of code
- The task requires reading more than 3 files to answer
- The task has multiple independent facets that can be researched in parallel
- You don't yet know which files are relevant and need to search broadly

**How to use sub-agents effectively:**
- Break the task into independent research questions and spawn one agent per question in a single response — they run in parallel.
- Give each agent a clear, focused prompt describing exactly what to find and report back.
- Example: if asked "describe this codebase", spawn agents for: project structure and entry points, core features and functionality, testing approach and coverage, configuration and build system.

### Making edits that succeed

The edit_file tool requires old_string to exactly match text in the file. Most edit failures come from the model generating old_string from memory instead of from the file. To avoid this:

1. Always read the file first with read_file.
2. Copy the exact text from the read output — do not retype it.
3. Strip line number prefixes (e.g. "  42 | ") — they are not part of the file.
4. Preserve all whitespace exactly: indentation, tabs vs spaces, trailing spaces, blank lines.
5. If an edit fails with "old_string not found", re-read the file and try again with the exact text. Do not retry the same string.`;
}

/**
 * Builds a standalone system prompt for sub-agents.
 * Sub-agents get system info and git context for awareness, but not user
 * instruction files or skills — those contain write/workflow guidance that
 * is irrelevant and potentially confusing for a read-only research agent.
 */
export function loadSubAgentInstructions(): string {
  const systemInfo = getSystemInfo();
  const gitContext = getGitContext();
  const header = gitContext ? `${systemInfo}\n\n${gitContext}` : systemInfo;

  return `${header}

You are a read-only research sub-agent. Your job is to explore the codebase, gather information, and return a clear summary of your findings. You cannot modify files, run commands, or interact with the user.

## Using your tools

You have access to: read_file, glob, grep, web_search, and skill.

### Exploration strategy

Match your approach to what you need to find:

1. **Find files by name or pattern**: Use glob with patterns like "**/*.ts" or "src/**/index.ts".
2. **Find content in files**: Use grep with regex patterns like "functionName", "import.*module".
3. **Read and understand files**: Use read_file. Files over 500 lines are truncated — use startLine and endLine for large files.
4. **Look up external information**: Use web_search for documentation, API references, or error messages not found in the codebase.

### Parallel tool calls

When you need to make multiple tool calls that are independent of each other, make them all in the same response. This runs them in parallel and is significantly faster.

Good candidates for parallel calls:
- Reading multiple files at once
- Running glob and grep searches simultaneously
- Combining a glob search with a grep search to find files by name and content at the same time

Do NOT parallelise calls that depend on each other — if you need the result of one call to inform another, run them sequentially.

### Tips for efficient exploration

- Start with glob or grep to locate relevant files, then read_file to understand them.
- The line number prefix in read_file output (e.g. "  42 | ") is formatting only — not part of the file content.
- grep returns results as "file:line_number:content" — use the line numbers to read specific ranges with read_file.

When your task is complete, produce a clear, concise summary of your findings.`;
}
