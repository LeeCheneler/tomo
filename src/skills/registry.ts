import type { SkillDefinition, SkillSource } from "./types";

/** Composite key for storing skills by name and source. */
function skillKey(name: string, source: SkillSource): string {
  return `${name}:${source}`;
}

/** Registry for looking up and listing skills. */
export interface SkillRegistry {
  /** Adds a skill to the registry. Overwrites if the same name+source exists. */
  register: (skill: SkillDefinition) => void;
  /** Returns a skill by name. When both sources exist, local takes priority. */
  get: (name: string) => SkillDefinition | undefined;
  /** Returns a skill by name and source. */
  getBySource: (
    name: string,
    source: SkillSource,
  ) => SkillDefinition | undefined;
  /** Returns all registered skills. */
  list: () => readonly SkillDefinition[];
  /** Returns true if any skill with the given name has a clash (exists in both sources). */
  hasClash: (name: string) => boolean;
}

/** Creates a new skill registry. */
export function createSkillRegistry(): SkillRegistry {
  const skills = new Map<string, SkillDefinition>();

  return {
    register(skill: SkillDefinition) {
      skills.set(skillKey(skill.name, skill.source), skill);
    },
    get(name: string) {
      // Local takes priority over global when both exist.
      return (
        skills.get(skillKey(name, "local")) ??
        skills.get(skillKey(name, "global"))
      );
    },
    getBySource(name: string, source: SkillSource) {
      return skills.get(skillKey(name, source));
    },
    list() {
      return [...skills.values()];
    },
    hasClash(name: string) {
      return (
        skills.has(skillKey(name, "local")) &&
        skills.has(skillKey(name, "global"))
      );
    },
  };
}
