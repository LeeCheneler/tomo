import chalk from "chalk";
import type { CommandContext, CommandDefinition } from "./registry";

/** Width of the progress bar in characters. */
const BAR_WIDTH = 20;

/** Renders a progress bar string like [████████░░░░░░░░░░░░]. */
function renderBar(fraction: number): string {
  const clamped = Math.max(0, Math.min(1, fraction));
  const filled = Math.round(clamped * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return `[${chalk.cyan("█".repeat(filled))}${chalk.gray("░".repeat(empty))}]`;
}

/** Formats token usage as a context stats string with a progress bar. */
function formatContext(context: CommandContext): string {
  if (!context.usage) {
    return "No usage data yet. Send a message first.";
  }

  const used = context.usage.promptTokens + context.usage.completionTokens;
  const window = context.contextWindow;
  const percent = Math.round((used / window) * 100);
  const bar = renderBar(used / window);

  return `${bar} ${used.toLocaleString()} / ${window.toLocaleString()} tokens (${percent}%)`;
}

/** Shows context window usage stats. */
export const contextCommand: CommandDefinition = {
  name: "context",
  description: "Show context usage",
  handler: (context) => formatContext(context),
};
