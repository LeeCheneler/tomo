/** A loaded skill definition parsed from a SKILL.md file. */
export interface Skill {
  /** The skill name (from frontmatter or directory name). */
  name: string;
  /** A short description of the skill. */
  description: string;
  /** The markdown body (everything after the frontmatter). */
  body: string;
  /** Whether this skill was loaded from the local project directory. */
  local: boolean;
  /** The skill set name this skill was loaded from, if any. */
  skillSet?: string;
}
