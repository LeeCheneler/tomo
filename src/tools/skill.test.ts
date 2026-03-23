import { describe, expect, it, vi } from "vitest";
import type { Skill } from "../skills";

const testSkills: Skill[] = [
  {
    name: "commit",
    description: "Commit changes",
    body: "Follow conventional commits.\n\nBe concise.",
    local: false,
  },
  {
    name: "review",
    description: "(local) Review code",
    body: "Review the code for bugs.",
    local: true,
  },
];

vi.mock("../skills", () => ({
  getAllSkills: () => testSkills,
  getSkill: (name: string) => testSkills.find((s) => s.name === name),
}));

// Import after mock to use mocked skills.
await import("./skill");
const { getTool } = await import("./registry");

const mockContext = {
  renderInteractive: vi.fn(),
  reportProgress: vi.fn(),
  permissions: {},
};

describe("skill tool", () => {
  it("is registered as non-interactive", () => {
    const tool = getTool("skill");
    expect(tool).toBeDefined();
    expect(tool?.interactive).toBe(false);
  });

  it("has a dynamic description listing available skills", () => {
    const tool = getTool("skill");
    expect(tool?.description).toContain("Available skills:");
    expect(tool?.description).toContain("commit: Commit changes");
    expect(tool?.description).toContain("review: (local) Review code");
  });

  it("returns skill body for a known skill", async () => {
    const tool = getTool("skill");
    const result = await tool?.execute(
      JSON.stringify({ name: "commit" }),
      mockContext,
    );
    expect(result).toBe("Follow conventional commits.\n\nBe concise.");
  });

  it("returns error for unknown skill", async () => {
    const tool = getTool("skill");
    const result = await tool?.execute(
      JSON.stringify({ name: "nonexistent" }),
      mockContext,
    );
    expect(result).toContain('Unknown skill: "nonexistent"');
    expect(result).toContain("commit");
    expect(result).toContain("review");
  });

  it("throws for empty name", async () => {
    const tool = getTool("skill");
    await expect(
      tool?.execute(JSON.stringify({ name: "" }), mockContext),
    ).rejects.toThrow("skill name is required");
  });
});
