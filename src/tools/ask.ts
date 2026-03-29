import React from "react";
import { z } from "zod";
import { AskSelector } from "../components/ask-selector";
import { registerTool } from "./registry";
import { parseToolArgs, type ToolContext } from "./types";

const argsSchema = z.object({
  question: z.string().default("Please choose:"),
  options: z.array(z.string()).default([]),
});

registerTool({
  name: "ask",
  displayName: "Ask",
  description: `Present the user with a multiple-choice question and return their selection.

- Use sparingly — only when you genuinely need the user to choose between meaningfully different options.
- Do not ask for confirmation on routine actions. Do not ask questions you can resolve by reading the codebase.
- Provide clear, distinct options. The returned value is the exact option string the user selected.
- A free-text input is always shown as the last option so the user can type a custom response instead of choosing a predefined option. Never include "Other", "Custom", or any free-text escape hatch in the options array — the tool provides this automatically.
- Omitting options (or passing an empty array) renders a plain text input with no predefined choices — use this when you need a free-form answer.`,
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
          "The available choices. Omit or pass an empty array for a plain text input with no predefined choices.",
      },
    },
    required: ["question"],
  },
  async execute(args: string, context: ToolContext): Promise<string> {
    const { question, options } = parseToolArgs(argsSchema, args);

    return context.renderInteractive((onResult, onCancel) =>
      React.createElement(AskSelector, {
        question,
        options,
        onSelect: onResult,
        onCancel,
      }),
    );
  },
});
