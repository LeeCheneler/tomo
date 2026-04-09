import { z } from "zod";
import type { SkillRegistry } from "../skills/registry";
import type { Tool, ToolResult } from "./types";
import { err, ok } from "./types";

/** Zod schema for skill arguments. */
const argsSchema = z.object({
  name: z.string().min(1, "skill name must not be empty"),
});

/** Builds the tool description including available skill names. */
function buildDescription(registry: SkillRegistry): string {
  const skills = registry.list();

  if (skills.length === 0) {
    return "Invoke a skill by name. No skills are currently available.";
  }

  const lines = skills.map((s) => `- **${s.name}** — ${s.description}`);

  return `Invoke a skill by name to inject its prompt into the conversation. The skill content will be returned as the tool result.

Available skills:
${lines.join("\n")}`;
}

/** Creates a skill tool that looks up skills from the given registry. */
export function createSkillTool(registry: SkillRegistry): Tool {
  return {
    name: "skill",
    displayName: "Skill",
    description: buildDescription(registry),
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "The name of the skill to invoke",
        },
      },
      required: ["name"],
    },
    argsSchema,
    formatCall(args: Record<string, unknown>): string {
      return String(args.name ?? "");
    },
    async execute(args: unknown): Promise<ToolResult> {
      const parsed = argsSchema.parse(args);
      const skill = registry.get(parsed.name);

      if (!skill) {
        const available = registry.list().map((s) => s.name);
        const hint =
          available.length > 0
            ? ` Available skills: ${available.join(", ")}`
            : "";
        return err(`Unknown skill: "${parsed.name}".${hint}`);
      }

      return ok(skill.content);
    },
  };
}
