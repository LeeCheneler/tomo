import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Returns the directory where skill set sources are cloned. */
export function skillSetsDir(): string {
  return resolve(homedir(), ".tomo", "skill-sets");
}

/** Generates a stable directory name from a source URL. */
export function sourceSlug(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  // Extract a human-readable suffix from the URL for easier debugging.
  const name = url
    .replace(/\.git$/, "")
    .split(/[/:]/g)
    .filter(Boolean)
    .slice(-2)
    .join("-");
  return `${name}-${hash}`;
}

/** Returns the local clone path for a source URL. */
export function sourceDir(url: string): string {
  return join(skillSetsDir(), sourceSlug(url));
}

/** Clones a git repo to the skill sets directory. Returns the local path. Cleans up on failure. */
export function cloneSource(url: string): string {
  const dir = sourceDir(url);
  if (existsSync(join(dir, ".git"))) {
    return dir;
  }
  try {
    execFileSync("git", ["clone", "--depth", "1", url, dir], {
      stdio: "pipe",
    });
  } catch (e) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
    throw e;
  }
  return dir;
}

/** Removes the cloned directory for a source. */
export function removeSource(url: string): void {
  const dir = sourceDir(url);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Pulls latest changes for a cloned source. */
export function pullSource(url: string): void {
  const dir = sourceDir(url);
  if (!existsSync(join(dir, ".git"))) return;
  execFileSync("git", ["pull"], { cwd: dir, stdio: "pipe" });
}
