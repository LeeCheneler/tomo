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

/**
 * Discovers and loads all skills from global and local directories.
 * Local skills shadow global skills with the same name.
 * Local skills have "(local)" prefixed to their description.
 */
export function loadSkills(globalDir?: string, localDir?: string): Skill[] {
  const globalSkills = loadFromDir(globalDir ?? globalSkillsDir(), false);
  const localSkills = loadFromDir(localDir ?? localSkillsDir(), true).map(
    (skill) => ({
      ...skill,
      description: `(local) ${skill.description}`,
    }),
  );

  const byName = new Map<string, Skill>();

  for (const skill of globalSkills) {
    byName.set(skill.name, skill);
  }
  // Local skills overwrite global with same name.
  for (const skill of localSkills) {
    byName.set(skill.name, skill);
  }

  return [...byName.values()];
}
