import chalk from "chalk";
import { diffLines } from "diff";

const MAX_DIFF_LINES = 80;

/** Format a unified diff with git-style coloring for terminal display. */
export function formatDiff(oldContent: string, newContent: string): string {
  const changes = diffLines(oldContent, newContent);
  const lines: string[] = [];

  for (const change of changes) {
    // Split value into individual lines, dropping trailing empty from final newline
    const raw = change.value.replace(/\n$/, "").split("\n");

    for (const line of raw) {
      if (change.added) {
        lines.push(chalk.green(`+ ${line}`));
      } else if (change.removed) {
        lines.push(chalk.red(`- ${line}`));
      } else {
        lines.push(chalk.dim(`  ${line}`));
      }
    }
  }

  if (lines.length > MAX_DIFF_LINES) {
    const truncated = lines.slice(0, MAX_DIFF_LINES);
    truncated.push(
      chalk.dim(`  ... ${lines.length - MAX_DIFF_LINES} more lines`),
    );
    return truncated.join("\n");
  }

  return lines.join("\n");
}

/** Format new file content as all-additions diff. */
export function formatNewFile(content: string): string {
  const raw = content.replace(/\n$/, "").split("\n");
  const lines = raw.map((line) => chalk.green(`+ ${line}`));

  if (lines.length > MAX_DIFF_LINES) {
    const truncated = lines.slice(0, MAX_DIFF_LINES);
    truncated.push(
      chalk.dim(`  ... ${lines.length - MAX_DIFF_LINES} more lines`),
    );
    return truncated.join("\n");
  }

  return lines.join("\n");
}
