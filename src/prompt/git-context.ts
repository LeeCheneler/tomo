import { execSync } from "node:child_process";

/** Runs a git command in the given directory and returns trimmed stdout. */
function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, { cwd, stdio: "pipe" }).toString().trim();
}

/** Checks whether a directory is inside a git repository. */
export function isGitRepo(cwd: string): boolean {
  try {
    git(cwd, "rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

/** Returns the current branch name. */
export function getGitBranch(cwd: string): string {
  return git(cwd, "rev-parse --abbrev-ref HEAD");
}

/** Returns the default branch name from the origin remote, falling back to "main". */
export function getDefaultBranch(cwd: string): string {
  try {
    const ref = git(cwd, "symbolic-ref refs/remotes/origin/HEAD");
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    return "main";
  }
}

/** Returns a short working-tree status: "clean" or "<n> changed file(s)". */
export function getGitStatusSummary(cwd: string): string {
  const output = git(cwd, "status --porcelain");
  if (!output) return "clean";
  const lines = output.split("\n");
  return `${lines.length} changed file${lines.length === 1 ? "" : "s"}`;
}

/** Returns the last N commits in oneline format, or empty string if none. */
export function getGitLog(cwd: string, count = 10): string {
  return git(cwd, `log --oneline -${count}`);
}

/** Returns the origin remote URL, or null if none is configured. */
export function getGitRemoteUrl(cwd: string): string | null {
  try {
    return git(cwd, "remote get-url origin");
  } catch {
    return null;
  }
}

/** Checks whether the origin remote points to GitHub. */
export function isGitHubRemote(cwd: string): boolean {
  const url = getGitRemoteUrl(cwd);
  if (!url) return false;
  return url.includes("github.com");
}

/** Checks whether the GitHub CLI (gh) is installed and on PATH. */
export function isGhCliAvailable(): boolean {
  try {
    execSync("which gh", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Builds git context for the system prompt.
 * Returns null if the cwd is not inside a git repository.
 */
export function getGitContext(cwd: string): string | null {
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
