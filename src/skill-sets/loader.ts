import { resolve } from "node:path";
import { fileExists, isDirectory, listDir, readFile } from "../utils/fs";
import { loadSkillsFromDir } from "../skills/loader";
import type { SkillDefinition } from "../skills/types";
import { sourceDir } from "./git";

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
function parseManifest(
  path: string,
): { name: string; description: string } | null {
  try {
    const content = readFile(path);
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (typeof parsed.name !== "string" || parsed.name === "") return null;
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
  if (!isDirectory(dir)) return [];

  const results: DiscoveredSkillSet[] = [];
  const entries = listDir(dir);

  for (const entry of entries) {
    if (entry.startsWith(".")) continue;

    const entryPath = resolve(dir, entry);
    if (!isDirectory(entryPath)) continue;

    const manifestPath = resolve(entryPath, "tomo-skills.json");
    if (!fileExists(manifestPath)) continue;

    const manifest = parseManifest(manifestPath);
    if (!manifest) continue;

    results.push({
      name: manifest.name,
      description: manifest.description,
      path: entryPath,
      sourceUrl,
    });
  }

  return results;
}

/** Discovers all skill sets from a cloned source. */
export function discoverSkillSets(url: string): DiscoveredSkillSet[] {
  const dir = sourceDir(url);
  return findSkillSets(dir, url);
}

/** Loads skills from a skill set directory, namespaced as setName:skillName. */
export function loadSkillSetSkills(set: DiscoveredSkillSet): SkillDefinition[] {
  const skills = loadSkillsFromDir(set.path, "global");
  return skills.map((skill) => ({
    ...skill,
    name: `${set.name}:${skill.name}`,
  }));
}
