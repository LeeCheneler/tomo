import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type MockFsState, mockFs } from "../test-utils/mock-fs";
import {
  GLOBAL_SKILLS_DIR,
  LOCAL_SKILLS_DIR,
  loadAllSkills,
  loadSkillsFromDir,
} from "./loader";

/** Builds a valid SKILL.md with frontmatter. */
function skillFile(name: string, description: string, content: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n${content}`;
}

describe("loadSkillsFromDir", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("loads a skill from a subdirectory with a valid SKILL.md", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "review/SKILL.md")]: skillFile(
        "code-review",
        "Review code for quality",
        "You are a code reviewer.",
      ),
    });

    const skills = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
    expect(skills).toHaveLength(1);
    expect(skills[0]).toEqual({
      name: "code-review",
      description: "Review code for quality",
      content: "You are a code reviewer.",
      source: "global",
    });
  });

  it("loads multiple skills from separate subdirectories", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "review/SKILL.md")]: skillFile(
        "code-review",
        "Review code",
        "Review prompt.",
      ),
      [resolve(GLOBAL_SKILLS_DIR, "deploy/SKILL.md")]: skillFile(
        "deploy",
        "Deploy app",
        "Deploy prompt.",
      ),
    });

    const skills = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name)).toContain("code-review");
    expect(skills.map((s) => s.name)).toContain("deploy");
  });

  it("returns empty array when directory does not exist", () => {
    state = mockFs({});
    const skills = loadSkillsFromDir("/nonexistent/path", "global");
    expect(skills).toEqual([]);
  });

  it("skips subdirectories without SKILL.md", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "empty/README.md")]: "not a skill",
    });

    const skills = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
    expect(skills).toEqual([]);
  });

  it("skips SKILL.md without frontmatter", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "bad/SKILL.md")]:
        "Just some content with no frontmatter.",
    });

    const skills = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
    expect(skills).toEqual([]);
  });

  it("skips SKILL.md with invalid frontmatter", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "bad/SKILL.md")]:
        "---\ndescription: missing name\n---\nContent here.",
    });

    const skills = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
    expect(skills).toEqual([]);
  });

  it("skips non-directory entries in the skills directory", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "stray-file.txt")]: "not a directory",
    });

    const skills = loadSkillsFromDir(GLOBAL_SKILLS_DIR, "global");
    expect(skills).toEqual([]);
  });

  it("sets source to local when loading from local directory", () => {
    state = mockFs({
      [resolve(LOCAL_SKILLS_DIR, "test/SKILL.md")]: skillFile(
        "test-skill",
        "A test skill",
        "Test content.",
      ),
    });

    const skills = loadSkillsFromDir(LOCAL_SKILLS_DIR, "local");
    expect(skills).toHaveLength(1);
    expect(skills[0].source).toBe("local");
  });
});

describe("loadAllSkills", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("loads skills from both global and local directories", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "global-skill/SKILL.md")]: skillFile(
        "global-skill",
        "A global skill",
        "Global content.",
      ),
      [resolve(LOCAL_SKILLS_DIR, "local-skill/SKILL.md")]: skillFile(
        "local-skill",
        "A local skill",
        "Local content.",
      ),
    });

    const skills = loadAllSkills();
    expect(skills).toHaveLength(2);
    expect(skills[0].source).toBe("global");
    expect(skills[1].source).toBe("local");
  });

  it("returns empty array when no skills exist", () => {
    state = mockFs({});
    const skills = loadAllSkills();
    expect(skills).toEqual([]);
  });

  it("includes both when global and local have the same skill name", () => {
    state = mockFs({
      [resolve(GLOBAL_SKILLS_DIR, "review/SKILL.md")]: skillFile(
        "code-review",
        "Global review",
        "Global review prompt.",
      ),
      [resolve(LOCAL_SKILLS_DIR, "review/SKILL.md")]: skillFile(
        "code-review",
        "Local review",
        "Local review prompt.",
      ),
    });

    const skills = loadAllSkills();
    expect(skills).toHaveLength(2);

    const global = skills.find((s) => s.source === "global");
    const local = skills.find((s) => s.source === "local");
    expect(global?.name).toBe("code-review");
    expect(local?.name).toBe("code-review");
  });
});
