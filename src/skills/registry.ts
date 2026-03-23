import { loadSkills } from "./loader";
import type { Skill } from "./types";

let skills: Skill[] | null = null;

/** Loads skills from disk (if not already loaded) and returns all discovered skills. */
export function getAllSkills(): Skill[] {
  if (!skills) {
    skills = loadSkills();
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
