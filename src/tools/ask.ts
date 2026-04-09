import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "./types";
import { err, ok } from "./types";

// LLMs are imprecise at counting characters, so each length cap has a soft
// target (shown to the model in the description, JSON schema, and rejection
// error messages) and a larger hard limit enforced by the zod validator. The
// gap prevents spurious rejections when the model lands slightly over its
// target while still keeping prompts tight in practice. The option soft
// target is pulled lower than necessary on purpose: option labels render in
// the SelectList and stop being scannable past ~60 chars, so the soft target
// nudges the model toward compact, choice-like labels rather than sentences.
// This discrepancy is intentional.
/** Soft target for the question shown to the LLM. */
const QUESTION_SOFT_LIMIT = 175;
/** Hard limit for the question enforced by the zod validator. */
const QUESTION_HARD_LIMIT = 200;
/** Soft target for option labels shown to the LLM. */
const OPTION_SOFT_LIMIT = 60;
/** Hard limit for option labels enforced by the zod validator. */
const OPTION_HARD_LIMIT = 80;

/** Zod schema for ask arguments. */
const argsSchema = z.object({
  question: z
    .string()
    .min(1, "question must not be empty")
    .max(
      QUESTION_HARD_LIMIT,
      `question must be ${QUESTION_SOFT_LIMIT} characters or fewer. Show long content in your assistant message first, then call ask with a short decision question.`,
    )
    .refine(
      (s) => !/[\n\r]/.test(s),
      "question must be a single line — newlines are not allowed. Show multi-line content in your assistant message and call ask with a short decision question.",
    ),
  options: z
    .array(
      z
        .string()
        .max(
          OPTION_HARD_LIMIT,
          `option labels must be ${OPTION_SOFT_LIMIT} characters or fewer.`,
        ),
    )
    .optional(),
});

/** The ask tool definition. */
export const askTool: Tool = {
  name: "ask",
  displayName: "Ask",
  description: `Present the user with a single short decision question and return their response.

Two modes:
1. **With options** — pass an array of choices. The user picks one from the list, or presses tab to type a free-text response instead.
2. **Without options** — omit the options array entirely. The user types a free-form answer. Use this for open-ended questions.

Length & format:
- The question must be a single line, no newlines, max ${QUESTION_SOFT_LIMIT} characters.
- Each option label must be max ${OPTION_SOFT_LIMIT} characters.

If you need to show a draft, code snippet, summary, or other long content for approval, write it as your normal assistant message first, then call this tool with a brief question. Do NOT stuff the content into the question itself — the prompt is rendered in a small bordered panel and long content makes it unreadable.

Good:
  [assistant message containing the draft]
  ask({ question: "Send this draft?", options: ["Send", "Edit", "Cancel"] })

Bad:
  ask({ question: "Send the following draft...\\n\\nSubject: ...\\n\\nBody: ..." })

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
        description:
          "The question to ask the user. Must be a single short line, no newlines.",
        maxLength: QUESTION_SOFT_LIMIT,
      },
      options: {
        type: "array",
        items: { type: "string", maxLength: OPTION_SOFT_LIMIT },
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
