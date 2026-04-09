import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type MockFsState, mockFs } from "../test-utils/mock-fs";
import { discoverSkillSets, findSkillSets, loadSkillSetSkills } from "./loader";
import type { DiscoveredSkillSet } from "./loader";
import { sourceDir } from "./git";

/** Builds a valid tomo-skills.json manifest. */
function manifest(name: string, description?: string): string {
  return JSON.stringify({ name, description: description ?? "" });
}

/** Builds a valid SKILL.md with frontmatter. */
function skillFile(name: string, description: string, content: string): string {
  return `---\nname: ${name}\ndescription: ${description}\n---\n${content}`;
}

describe("findSkillSets", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("discovers a skill set with name and description", () => {
    state = mockFs({
      [resolve("/repo/dev/tomo-skills.json")]: manifest("dev", "Dev tools"),
    });

    const sets = findSkillSets("/repo", "git@github.com:org/repo.git");
    expect(sets).toEqual([
      {
        name: "dev",
        description: "Dev tools",
        path: resolve("/repo/dev"),
        sourceUrl: "git@github.com:org/repo.git",
      },
    ]);
  });

  it("discovers a skill set with name only", () => {
    state = mockFs({
      [resolve("/repo/ops/tomo-skills.json")]: manifest("ops"),
    });

    const sets = findSkillSets("/repo", "url");
    expect(sets).toHaveLength(1);
    expect(sets[0].description).toBe("");
  });

  it("discovers multiple skill sets", () => {
    state = mockFs({
      [resolve("/repo/dev/tomo-skills.json")]: manifest("dev"),
      [resolve("/repo/design/tomo-skills.json")]: manifest("design"),
    });

    const sets = findSkillSets("/repo", "url");
    expect(sets).toHaveLength(2);
    expect(sets.map((s) => s.name).sort()).toEqual(["design", "dev"]);
  });

  it("returns empty for non-existent directory", () => {
    state = mockFs({});
    expect(findSkillSets("/nonexistent", "url")).toEqual([]);
  });

  it("skips directories without tomo-skills.json", () => {
    state = mockFs({
      [resolve("/repo/dev/tomo-skills.json")]: manifest("dev"),
      [resolve("/repo/docs/README.md")]: "hello",
    });

    const sets = findSkillSets("/repo", "url");
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe("dev");
  });

  it("skips hidden directories", () => {
    state = mockFs({
      [resolve("/repo/.git/tomo-skills.json")]: manifest("hidden"),
    });

    expect(findSkillSets("/repo", "url")).toEqual([]);
  });

  it("skips invalid JSON in tomo-skills.json", () => {
    state = mockFs({
      [resolve("/repo/bad/tomo-skills.json")]: "not valid json{{{",
    });

    expect(findSkillSets("/repo", "url")).toEqual([]);
  });

  it("skips tomo-skills.json missing name field", () => {
    state = mockFs({
      [resolve("/repo/no-name/tomo-skills.json")]: JSON.stringify({
        description: "no name",
      }),
    });

    expect(findSkillSets("/repo", "url")).toEqual([]);
  });

  it("defaults description to empty string when non-string", () => {
    state = mockFs({
      [resolve("/repo/ops/tomo-skills.json")]: JSON.stringify({
        name: "ops",
        description: 42,
      }),
    });

    const sets = findSkillSets("/repo", "url");
    expect(sets).toHaveLength(1);
    expect(sets[0].description).toBe("");
  });

  it("skips non-directory entries in root", () => {
    state = mockFs({
      [resolve("/repo/README.md")]: "hello",
      [resolve("/repo/dev/tomo-skills.json")]: manifest("dev"),
    });

    const sets = findSkillSets("/repo", "url");
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe("dev");
  });

  it("passes sourceUrl through to discovered sets", () => {
    state = mockFs({
      [resolve("/repo/dev/tomo-skills.json")]: manifest("dev"),
    });

    const url = "git@github.com:org/my-skills.git";
    const sets = findSkillSets("/repo", url);
    expect(sets[0].sourceUrl).toBe(url);
  });
});

describe("discoverSkillSets", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("discovers sets from a cloned source by URL", () => {
    const url = "git@github.com:org/skills.git";
    const dir = sourceDir(url);
    state = mockFs({
      [resolve(dir, "dev/tomo-skills.json")]: manifest("dev", "Dev tools"),
    });

    const sets = discoverSkillSets(url);
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe("dev");
    expect(sets[0].sourceUrl).toBe(url);
  });

  it("returns empty when source is not cloned", () => {
    state = mockFs({});
    expect(discoverSkillSets("git@github.com:org/nope.git")).toEqual([]);
  });
});

describe("loadSkillSetSkills", () => {
  let state: MockFsState;

  afterEach(() => {
    state?.restore();
  });

  it("loads skills namespaced as setName:skillName", () => {
    state = mockFs({
      [resolve("/repo/dev/commit/SKILL.md")]: skillFile(
        "commit",
        "Commit changes",
        "Commit prompt.",
      ),
      [resolve("/repo/dev/pr/SKILL.md")]: skillFile(
        "pr",
        "Create PR",
        "PR prompt.",
      ),
    });

    const set: DiscoveredSkillSet = {
      name: "dev",
      description: "Dev tools",
      path: resolve("/repo/dev"),
      sourceUrl: "url",
    };

    const skills = loadSkillSetSkills(set);
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name).sort()).toEqual(["dev:commit", "dev:pr"]);
  });

  it("returns empty when set directory has no skills", () => {
    state = mockFs({
      [resolve("/repo/empty/tomo-skills.json")]: manifest("empty"),
    });

    const set: DiscoveredSkillSet = {
      name: "empty",
      description: "",
      path: resolve("/repo/empty"),
      sourceUrl: "url",
    };

    expect(loadSkillSetSkills(set)).toEqual([]);
  });
});
