import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

/** Returns the directory where skill set sources are cloned to. */
export function sourceCacheDir(): string {
  return resolve(homedir(), ".tomo", "skill-set-sources");
}

/** Generates a stable directory name for a source URL. */
export function sourceSlug(url: string): string {
  // Use a short hash to avoid filesystem issues with special chars in URLs.
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

/** Clones a git repo to the cache directory. Returns the local path. Cleans up on failure. */
export function cloneSource(url: string): string {
  const dir = join(sourceCacheDir(), sourceSlug(url));
  if (existsSync(join(dir, ".git"))) {
    return dir;
  }
  try {
    execSync(`git clone --depth 1 ${url} ${dir}`, {
      stdio: "pipe",
    });
  } catch (e) {
    // Clean up partial clone directory on failure.
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
    throw e;
  }
  return dir;
}

/** Pulls latest changes for a cloned source. */
export function pullSource(url: string): void {
  const dir = join(sourceCacheDir(), sourceSlug(url));
  if (!existsSync(join(dir, ".git"))) return;
  execSync("git pull origin main", { cwd: dir, stdio: "pipe" });
}

/** A discovered skill set within a cloned source. */
export interface DiscoveredSkillSet {
  /** The name from tomo-skills.json. */
  name: string;
  /** The description from tomo-skills.json, or empty string if absent. */
  description: string;
  /** The absolute path to the skill set directory. */
  path: string;
  /** The source URL this skill set belongs to. */
  sourceUrl: string;
}

/** Parses a tomo-skills.json file. Returns null if invalid. */
function parseSkillSetManifest(
  filePath: string,
): { name: string; description: string } | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.name !== "string" || !parsed.name) return null;
    return {
      name: parsed.name,
      description:
        typeof parsed.description === "string" ? parsed.description : "",
    };
  } catch {
    return null;
  }
}

/** Discovers all skill sets in a directory by finding tomo-skills.json files. */
export function findSkillSets(
  dir: string,
  sourceUrl: string,
): DiscoveredSkillSet[] {
  if (!existsSync(dir)) return [];

  const results: DiscoveredSkillSet[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;

    const entryPath = join(dir, entry.name);
    const manifestPath = join(entryPath, "tomo-skills.json");

    if (existsSync(manifestPath)) {
      const manifest = parseSkillSetManifest(manifestPath);
      if (manifest) {
        results.push({
          name: manifest.name,
          description: manifest.description,
          path: entryPath,
          sourceUrl,
        });
      }
    }
  }

  return results;
}

/** Discovers all skill sets from a cloned source. */
export function discoverSkillSets(url: string): DiscoveredSkillSet[] {
  const dir = join(sourceCacheDir(), sourceSlug(url));
  if (!existsSync(dir)) return [];
  return findSkillSets(dir, url);
}

/** Returns the absolute path of a specific skill set within a cloned source, or null if not found. */
export function getSkillSetPath(
  sourceUrl: string,
  setName: string,
): string | null {
  const sets = discoverSkillSets(sourceUrl);
  const match = sets.find((s) => s.name === setName);
  return match?.path ?? null;
}
