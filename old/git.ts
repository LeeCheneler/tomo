import { execSync } from "node:child_process";

function git(cwd: string, args: string): string {
  return execSync(`git ${args}`, { cwd, stdio: "pipe" }).toString().trim();
}

/** Check whether a directory is inside a git repository. */
export function isGitRepo(cwd: string): boolean {
  try {
    git(cwd, "rev-parse --is-inside-work-tree");
    return true;
  } catch {
    return false;
  }
}

/** Return the current branch name. */
export function getGitBranch(cwd: string): string {
  return git(cwd, "rev-parse --abbrev-ref HEAD");
}

/** Return the default branch name from the origin remote, falling back to "main". */
export function getDefaultBranch(cwd: string): string {
  try {
    const ref = git(cwd, "symbolic-ref refs/remotes/origin/HEAD");
    return ref.replace("refs/remotes/origin/", "");
  } catch {
    return "main";
  }
}

/** Return a short working-tree status: "clean" or "<n> changed file(s)". */
export function getGitStatusSummary(cwd: string): string {
  const output = git(cwd, "status --porcelain");
  if (!output) return "clean";
  const lines = output.split("\n");
  return `${lines.length} changed file${lines.length === 1 ? "" : "s"}`;
}

/** Return the last {@link count} commits in oneline format. */
export function getGitLog(cwd: string, count = 10): string {
  return git(cwd, `log --oneline -${count}`);
}

/** Return the origin remote URL, or null if none is configured. */
export function getGitRemoteUrl(cwd: string): string | null {
  try {
    return git(cwd, "remote get-url origin");
  } catch {
    return null;
  }
}

/** Check whether the origin remote points to GitHub. */
export function isGitHubRemote(cwd: string): boolean {
  const url = getGitRemoteUrl(cwd);
  if (!url) return false;
  return url.includes("github.com");
}

/** Check whether the GitHub CLI (`gh`) is installed and on PATH. */
export function isGhCliAvailable(): boolean {
  try {
    execSync("which gh", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}
