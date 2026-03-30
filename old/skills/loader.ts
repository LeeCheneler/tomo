import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import type { Skill } from "./types";

/** Returns the global skills directory (~/.tomo/skills). */
function globalSkillsDir(): string {
  return resolve(homedir(), ".tomo", "skills");
}

/** Returns the local skills directory (.tomo/skills). */
function localSkillsDir(): string {
  return resolve(process.cwd(), ".tomo", "skills");
}

/**
 * Parses a SKILL.md file into a Skill object.
 * Returns null if the file cannot be parsed or is missing required fields.
 */
export function parseSkillFile(
  content: string,
  dirName: string,
  local: boolean,
): Skill | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = parse(match[1]) as Record<string, unknown> | null;
  if (!frontmatter) return null;

  const name =
    typeof frontmatter.name === "string" ? frontmatter.name : dirName;
  const description =
    typeof frontmatter.description === "string" ? frontmatter.description : "";
  const body = match[2].trim();

  if (!name) return null;

  return { name, description, body, local };
}

/**
 * Scans a skills directory for subdirectories containing SKILL.md files.
 * Returns an array of parsed skills.
 */
function loadFromDir(dir: string, local: boolean): Skill[] {
  if (!existsSync(dir)) return [];

  const skills: Skill[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillPath = join(dir, entry.name, "SKILL.md");
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, "utf-8");
    const skill = parseSkillFile(content, entry.name, local);
    if (skill) skills.push(skill);
  }

  return skills;
}

/** A skill set directory with its name for tagging loaded skills. */
export interface SkillSetDir {
  name: string;
  path: string;
}

/**
 * Discovers and loads all skills from skill set directories, global, and local directories.
 * Precedence (later wins): skill sets → global → local.
 * Local skills have "(local)" prefixed to their description.
 */
export function loadSkills(
  globalDir?: string,
  localDir?: string,
  skillSetDirs?: SkillSetDir[],
): Skill[] {
  const byName = new Map<string, Skill>();

  // Skill set skills are namespaced as setName:skillName.
  if (skillSetDirs) {
    for (const setDir of skillSetDirs) {
      const skills = loadFromDir(setDir.path, false);
      for (const skill of skills) {
        const namespacedName = `${setDir.name}:${skill.name}`;
        byName.set(namespacedName, {
          ...skill,
          name: namespacedName,
          skillSet: setDir.name,
        });
      }
    }
  }

  // Global skills override skill set skills.
  const globalSkills = loadFromDir(globalDir ?? globalSkillsDir(), false);
  for (const skill of globalSkills) {
    byName.set(skill.name, skill);
  }

  // Local skills override everything.
  const localSkills = loadFromDir(localDir ?? localSkillsDir(), true).map(
    (skill) => ({
      ...skill,
      description: `(local) ${skill.description}`,
    }),
  );
  for (const skill of localSkills) {
    byName.set(skill.name, skill);
  }

  return [...byName.values()];
}
