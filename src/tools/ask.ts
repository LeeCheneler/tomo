import React from "react";
import { AskSelector } from "../components/ask-selector";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

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
    const parsed = JSON.parse(args);
    const question: string = parsed.question ?? "Please choose:";
    const options: string[] = parsed.options ?? [];

    if (options.length === 0) {
      return "Error: no options provided";
    }

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
