import { getEnabledSkillSets, loadConfig } from "../config";
import { getSkillSetPath } from "../skill-sets/sources";
import type { SkillSetDir } from "./loader";
import { loadSkills } from "./loader";
import type { Skill } from "./types";

let skills: Skill[] | null = null;

/** Resolves the directories of enabled skill sets from config. */
function resolveSkillSetDirs(): SkillSetDir[] {
  const config = loadConfig();
  const enabled = getEnabledSkillSets(config);
  const dirs: SkillSetDir[] = [];
  for (const entry of enabled) {
    const path = getSkillSetPath(entry.sourceUrl, entry.name);
    if (path) dirs.push({ name: entry.name, path });
  }
  return dirs;
}

/** Loads skills from disk (if not already loaded) and returns all discovered skills. */
export function getAllSkills(): Skill[] {
  if (!skills) {
    skills = loadSkills(undefined, undefined, resolveSkillSetDirs());
  }
  return skills;
}

/** Returns a skill by name, or undefined if not found. */
export function getSkill(name: string): Skill | undefined {
  return getAllSkills().find((s) => s.name === name);
}

/** Clears the cached skills, forcing a reload on next access. */
export function reloadSkills(): void {
  skills = null;
}
