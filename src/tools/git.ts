import { execSync } from "node:child_process";

/** Check whether a directory is inside a git repository. */
export function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}
