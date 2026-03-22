import React from "react";
import { z } from "zod";
import { AskSelector } from "../components/ask-selector";
import { registerTool } from "./registry";
import { type ToolContext, parseToolArgs } from "./types";

const argsSchema = z.object({
  question: z.string().default("Please choose:"),
  options: z.array(z.string()).min(1, "no options provided"),
});

registerTool({
  name: "ask",
  description:
    "Ask the user a multiple-choice question. Use this when you need clarification or want the user to choose between options.",
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
        description: "The available choices (2 or more)",
      },
    },
    required: ["question", "options"],
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
