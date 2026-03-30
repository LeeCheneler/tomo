import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Skill } from "./types";

const testSkills: Skill[] = [
  {
    name: "commit",
    description: "Commit changes",
    body: "Commit instructions.",
    local: false,
  },
  {
    name: "review",
    description: "(local) Review code",
    body: "Review instructions.",
    local: true,
  },
];

vi.mock("./loader", () => ({
  loadSkills: () => [...testSkills],
}));

// Import after mocking so the registry uses the mocked loader.
const { getAllSkills, getSkill, reloadSkills } = await import("./registry");

describe("skills registry", () => {
  beforeEach(() => {
    reloadSkills();
  });

  it("getAllSkills returns all loaded skills", () => {
    const skills = getAllSkills();
    expect(skills).toHaveLength(2);
    expect(skills.map((s) => s.name)).toEqual(["commit", "review"]);
  });

  it("getSkill returns a skill by name", () => {
    const skill = getSkill("commit");
    expect(skill?.name).toBe("commit");
    expect(skill?.description).toBe("Commit changes");
  });

  it("getSkill returns undefined for unknown name", () => {
    expect(getSkill("nonexistent")).toBeUndefined();
  });

  it("caches skills after first load", () => {
    const first = getAllSkills();
    const second = getAllSkills();
    expect(first).toBe(second);
  });

  it("reloadSkills clears cache", () => {
    const first = getAllSkills();
    reloadSkills();
    const second = getAllSkills();
    // Same content but different reference since it was reloaded.
    expect(first).not.toBe(second);
    expect(second).toHaveLength(2);
  });
});
