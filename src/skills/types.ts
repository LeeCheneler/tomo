/** Where a skill was loaded from. */
export type SkillSource = "local" | "global";

/** A loaded skill definition parsed from a SKILL.md file. */
export interface SkillDefinition {
  /** Display name used in autocomplete and invocation. */
  name: string;
  /** Short description shown in autocomplete. */
  description: string;
  /** Prompt content from the SKILL.md body. */
  content: string;
  /** Whether the skill was loaded from the global or local directory. */
  source: SkillSource;
}
