import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types";
import { err, ok } from "./types";

/** Zod schema for ask arguments. */
const argsSchema = z.object({
  question: z.string().min(1, "question must not be empty"),
  options: z.array(z.string()).optional(),
});

/** The ask tool definition. */
export const askTool: Tool = {
  name: "ask",
  displayName: "Ask",
  description: `Present the user with a question and return their response.

Two modes:
1. **With options** — pass an array of choices. The user picks one from the list, or presses tab to type a free-text response instead.
2. **Without options** — omit the options array entirely. The user types a free-form answer. Use this for open-ended questions.

Guidelines:
- Use sparingly — only when you genuinely need user input to proceed.
- Do not ask for confirmation on routine actions. Do not ask questions you can resolve by reading the codebase.
- When providing options, keep them clear and distinct. The returned value is the exact option string the user selected, or their typed response.
- Do NOT include "Other" or "Custom" in the options array — a free-text input is always available automatically.`,
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The question to ask the user",
      },
      options: {
        type: "array",
        items: { type: "string" },
        description:
          "Predefined choices. Omit entirely for a free-text-only input.",
      },
    },
    required: ["question"],
  },
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    return String(args.question ?? "");
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const answer = await context.ask(parsed.question, parsed.options);
    if (answer === null) {
      return err("The user dismissed this question.");
    }
    return ok(answer);
  },
};
