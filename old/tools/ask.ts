import React from "react";
import { z } from "zod";
import { AskSelector } from "../components/ask-selector";
import { registerTool } from "./registry";
import { ok, parseToolArgs, type ToolContext, type ToolResult } from "./types";

const argsSchema = z.object({
  question: z.string().default("Please choose:"),
  options: z.array(z.string()).default([]),
});

registerTool({
  name: "ask",
  displayName: "Ask",
  description: `Present the user with a question and return their response.

- Use sparingly — only when you genuinely need the user to make a choice or provide input.
- Do not ask for confirmation on routine actions. Do not ask questions you can resolve by reading the codebase.
- Provide clear, distinct options. The returned value is the exact option string the user selected.
- A free-text input is always shown as the last option so the user can type a custom response instead of choosing a predefined option. Never include "Other", "Custom", or any free-text escape hatch in the options array — the tool provides this automatically.
- If no options are provided, the user is shown a text-only input to type a free-form response.`,
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
          "The available choices. Omit or pass an empty array for a text-only input.",
      },
    },
    required: ["question"],
  },
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const { question, options } = parseToolArgs(argsSchema, args);

    const answer = await context.renderInteractive((onResult, onCancel) =>
      React.createElement(AskSelector, {
        question,
        options,
        onSelect: onResult,
        onCancel,
      }),
    );
    return ok(answer);
  },
});
