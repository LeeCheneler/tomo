import { describe, expect, it } from "vitest";
import { createSkillRegistry } from "../skills/registry";
import type { SkillDefinition } from "../skills/types";
import { mockToolContext } from "../test-utils/stub-context";
import { createSkillTool } from "./skill";

/** Builds a minimal skill definition for testing. */
function fakeSkill(
  name: string,
  description: string,
  content: string,
): SkillDefinition {
  return { name, description, content, source: "global" };
}

describe("createSkillTool", () => {
  it("has correct name and parameters", () => {
    const registry = createSkillRegistry();
    const tool = createSkillTool(registry);
    expect(tool.name).toBe("skill");
    expect(tool.parameters).toHaveProperty("properties");
    expect(tool.parameters).toHaveProperty("required");
  });

  describe("description", () => {
    it("lists available skills in the description", () => {
      const registry = createSkillRegistry();
      registry.register(fakeSkill("commit", "Commit changes", "prompt"));
      const tool = createSkillTool(registry);
      expect(tool.description).toContain("commit");
      expect(tool.description).toContain("Commit changes");
    });

    it("shows fallback when no skills are available", () => {
      const registry = createSkillRegistry();
      const tool = createSkillTool(registry);
      expect(tool.description).toContain("No skills are currently available");
    });
  });

  describe("formatCall", () => {
    it("returns the skill name argument", () => {
      const registry = createSkillRegistry();
      const tool = createSkillTool(registry);
      expect(tool.formatCall({ name: "commit" })).toBe("commit");
    });

    it("returns empty string when name is missing", () => {
      const registry = createSkillRegistry();
      const tool = createSkillTool(registry);
      expect(tool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    it("returns skill content for a valid skill name", async () => {
      const registry = createSkillRegistry();
      registry.register(
        fakeSkill("commit", "Commit changes", "Run git commit."),
      );
      const tool = createSkillTool(registry);

      const result = await tool.execute({ name: "commit" }, mockToolContext());
      expect(result.status).toBe("ok");
      expect(result.output).toBe("Run git commit.");
    });

    it("returns error for unknown skill name", async () => {
      const registry = createSkillRegistry();
      const tool = createSkillTool(registry);

      const result = await tool.execute({ name: "nope" }, mockToolContext());
      expect(result.status).toBe("error");
      expect(result.output).toContain("Unknown skill");
      expect(result.output).toContain("nope");
    });

    it("includes available skill names in error hint", async () => {
      const registry = createSkillRegistry();
      registry.register(fakeSkill("commit", "Commit", "prompt"));
      registry.register(fakeSkill("review", "Review", "prompt"));
      const tool = createSkillTool(registry);

      const result = await tool.execute({ name: "nope" }, mockToolContext());
      expect(result.output).toContain("commit");
      expect(result.output).toContain("review");
    });

    it("omits hint when no skills are available", async () => {
      const registry = createSkillRegistry();
      const tool = createSkillTool(registry);

      const result = await tool.execute({ name: "nope" }, mockToolContext());
      expect(result.output).not.toContain("Available skills");
    });
  });
});
