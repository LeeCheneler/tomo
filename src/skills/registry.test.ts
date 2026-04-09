import { describe, expect, it } from "vitest";
import { createSkillRegistry } from "./registry";
import type { SkillDefinition } from "./types";

/** Creates a minimal skill definition for testing. */
function skill(
  name: string,
  source: "local" | "global",
  content = "prompt",
): SkillDefinition {
  return { name, description: `${name} description`, content, source };
}

describe("createSkillRegistry", () => {
  it("registers and retrieves a skill by name", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));

    expect(registry.get("review")).toEqual(skill("review", "global"));
  });

  it("returns undefined for unknown skill names", () => {
    const registry = createSkillRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists all registered skills", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));
    registry.register(skill("deploy", "local"));

    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((s) => s.name)).toContain("review");
    expect(list.map((s) => s.name)).toContain("deploy");
  });

  it("returns empty list when no skills are registered", () => {
    const registry = createSkillRegistry();
    expect(registry.list()).toEqual([]);
  });

  it("overwrites a skill with the same name and source", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global", "old"));
    registry.register(skill("review", "global", "new"));

    expect(registry.get("review")?.content).toBe("new");
    expect(registry.list()).toHaveLength(1);
  });

  it("stores both local and global skills with the same name", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));
    registry.register(skill("review", "local"));

    expect(registry.list()).toHaveLength(2);
  });

  it("returns local skill when both sources exist for the same name", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global", "global prompt"));
    registry.register(skill("review", "local", "local prompt"));

    const result = registry.get("review");
    expect(result?.source).toBe("local");
    expect(result?.content).toBe("local prompt");
  });

  it("returns global skill when no local exists", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));

    expect(registry.get("review")?.source).toBe("global");
  });

  it("retrieves a specific source with getBySource", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global", "global prompt"));
    registry.register(skill("review", "local", "local prompt"));

    expect(registry.getBySource("review", "global")?.content).toBe(
      "global prompt",
    );
    expect(registry.getBySource("review", "local")?.content).toBe(
      "local prompt",
    );
  });

  it("returns undefined from getBySource for missing source", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));

    expect(registry.getBySource("review", "local")).toBeUndefined();
  });

  it("detects name clashes between local and global", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));
    registry.register(skill("review", "local"));

    expect(registry.hasClash("review")).toBe(true);
  });

  it("returns false for hasClash when only one source exists", () => {
    const registry = createSkillRegistry();
    registry.register(skill("review", "global"));

    expect(registry.hasClash("review")).toBe(false);
  });

  it("returns false for hasClash on unknown names", () => {
    const registry = createSkillRegistry();
    expect(registry.hasClash("nonexistent")).toBe(false);
  });
});
