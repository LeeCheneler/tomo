import { describe, expect, it, vi } from "vitest";
import type { Skill } from "../skills";

vi.mock("../skills", () => ({
  getAllSkills: (): Skill[] => [
    {
      name: "commit",
      description: "(local) Commit changes",
      body: "Commit body.",
      local: true,
    },
    {
      name: "pr",
      description: "Create a pull request",
      body: "PR body.",
      local: false,
    },
  ],
}));

// Import after mock so the register() call uses mocked skills.
await import("./skills");
const { getCommand } = await import("./registry");

describe("/skills command", () => {
  it("lists all available skills", () => {
    const cmd = getCommand("skills");
    expect(cmd).toBeDefined();

    const result = cmd?.execute("", {} as never);
    expect(result).toHaveProperty("output");
    const output = (result as { output: string }).output;
    expect(output).toContain("commit");
    expect(output).toContain("Commit changes");
    expect(output).toContain("pr");
    expect(output).toContain("Create a pull request");
  });

  it("formats output with header and aligned columns", () => {
    const cmd = getCommand("skills");
    const result = cmd?.execute("", {} as never) as { output: string };
    const output = result.output;
    expect(output).toContain("Available skills:");
    // Header + blank line + 2 skill lines
    const lines = output.split("\n");
    expect(lines).toHaveLength(4);
  });
});
