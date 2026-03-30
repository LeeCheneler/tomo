import chalk from "chalk";
import { ok } from "../tools/types";
import { register } from "./registry";
import type { Command } from "./types";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const BAR_WIDTH = 30;
const FILLED = "█";
const EMPTY = "░";

function progressBar(percent: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round((clamped / 100) * BAR_WIDTH);
  return FILLED.repeat(filled) + EMPTY.repeat(BAR_WIDTH - filled);
}

const context: Command = {
  name: "context",
  description: "Show context window usage stats",
  execute: (_args, callbacks) => {
    const { tokenUsage, contextWindow, maxTokens } = callbacks;

    const total = tokenUsage
      ? tokenUsage.promptTokens + tokenUsage.completionTokens
      : 0;
    const percent = Math.round((total / contextWindow) * 100);
    const inputBudget = contextWindow - maxTokens;

    const lines = [
      `  ${progressBar(percent)}  ${percent}% used`,
      `  ${formatTokens(total)} / ${formatTokens(contextWindow)} tokens`,
      ``,
      `  Context window     ${formatTokens(contextWindow)} tokens`,
      `  Response reserve   ${formatTokens(maxTokens)} tokens`,
      `  Input budget       ${formatTokens(inputBudget)} tokens`,
      ``,
      chalk.dim(`  (input budget = context window - response reserve)`),
    ];

    return ok(lines.join("\n"));
  },
};

register(context);
