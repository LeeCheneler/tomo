import { homedir } from "node:os";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { fileExists, isDirectory, listDir, readFile } from "../utils/fs";
import type { SkillDefinition, SkillSource } from "./types";

/** Path to the global skills directory (~/.tomo/skills). */
export const GLOBAL_SKILLS_DIR = resolve(homedir(), ".tomo", "skills");

/** Path to the local skills directory (.tomo/skills in cwd). */
export const LOCAL_SKILLS_DIR = resolve(process.cwd(), ".tomo", "skills");

/** Schema for SKILL.md frontmatter. */
const frontmatterSchema = z.object({
  name: z.string().min(1, "skill name is required"),
  description: z.string().min(1, "skill description is required"),
});

/** Separates YAML frontmatter from markdown body content. */
function parseFrontmatter(raw: string): { meta: unknown; body: string } | null {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (!match) return null;
  return { meta: parse(match[1]), body: match[2].trim() };
}

/** Loads all skills from a directory. Each subdirectory should contain a SKILL.md file. */
export function loadSkillsFromDir(
  dir: string,
  source: SkillSource,
): SkillDefinition[] {
  if (!isDirectory(dir)) return [];

  const entries = listDir(dir);
  const skills: SkillDefinition[] = [];

  for (const entry of entries) {
    const skillDir = resolve(dir, entry);
    if (!isDirectory(skillDir)) continue;

    const skillPath = resolve(skillDir, "SKILL.md");
    if (!fileExists(skillPath)) continue;

    const raw = readFile(skillPath);
    const parsed = parseFrontmatter(raw);
    if (!parsed) continue;

    const result = frontmatterSchema.safeParse(parsed.meta);
    if (!result.success) continue;

    skills.push({
      name: result.data.name,
      description: result.data.description,
      content: parsed.body,
      source,
    });
  }

  return skills;
}

/** Loads skills from both global and local directories. */
export function loadAllSkills(): SkillDefinition[] {
  const global = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
  const local = loadSkillsFromDir(LOCAL_SKILLS_DIR, "local");
  return [...global, ...local];
}
