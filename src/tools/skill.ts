import { z } from "zod";
import { getAllSkills, getSkill } from "../skills";
import { registerTool } from "./registry";
import { parseToolArgs } from "./types";

const argsSchema = z.object({
  name: z.string().min(1, "skill name is required"),
});

function buildDescription(): string {
  const skills = getAllSkills();
  if (skills.length === 0) {
    return "Load a skill to receive specialised instructions for a specific type of task. No skills are currently available.";
  }
  const list = skills.map((s) => `- ${s.name}: ${s.description}`).join("\n");
  return `Load a skill to receive specialised instructions for a specific type of task. Skills provide expert-level guidance for workflows like committing, creating PRs, creating issues, and more.

Before starting work on a user request, check if an available skill matches the task and load it first — skill instructions take priority. Available skills:\n${list}`;
}

registerTool({
  name: "skill",
  displayName: "Skill",
  description: buildDescription(),
  parameters: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "The skill name to load",
      },
    },
    required: ["name"],
  },
  interactive: false,
  async execute(args: string): Promise<string> {
    const { name } = parseToolArgs(argsSchema, args);
    const skill = getSkill(name);
    if (!skill) {
      const available = getAllSkills()
        .map((s) => s.name)
        .join(", ");
      return available
        ? `Unknown skill: "${name}". Available skills: ${available}`
        : `Unknown skill: "${name}". No skills are available.`;
    }
    return skill.body;
  },
});
