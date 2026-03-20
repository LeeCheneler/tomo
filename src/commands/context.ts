import { register } from "./registry";
import type { Command } from "./types";

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const context: Command = {
  name: "context",
  description: "Show context window usage stats",
  execute: (_args, callbacks) => {
    const { tokenUsage, contextWindow, maxTokens, messageCount } = callbacks;

    if (!tokenUsage) {
      return { output: "No token usage data yet — send a message first." };
    }

    const total = tokenUsage.promptTokens + tokenUsage.completionTokens;
    const percent = Math.round((total / contextWindow) * 100);
    const inputBudget = contextWindow - maxTokens;

    const lines = [
      `  Context window:    ${formatTokens(contextWindow)} tokens`,
      `  Prompt tokens:     ${formatTokens(tokenUsage.promptTokens)}`,
      `  Response tokens:   ${formatTokens(tokenUsage.completionTokens)}`,
      `  Total used:        ${formatTokens(total)} (${percent}%)`,
      `  Input budget:      ${formatTokens(inputBudget)} (window - ${formatTokens(maxTokens)} reserved)`,
      `  Max tokens:        ${formatTokens(maxTokens)}`,
      `  Messages:          ${messageCount}`,
    ];

    return { output: lines.join("\n") };
  },
};

register(context);
