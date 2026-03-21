import chalk from "chalk";
import { diffLines } from "diff";

const CONTEXT_LINES = 3;
const MAX_NEW_FILE_LINES = 80;

interface DiffLine {
  type: "added" | "removed" | "context";
  text: string;
}

/** Format a unified diff with git-style coloring, showing only changed hunks with context. */
export function formatDiff(oldContent: string, newContent: string): string {
  const changes = diffLines(oldContent, newContent);

  // Flatten changes into individual tagged lines
  const allLines: DiffLine[] = [];
  for (const change of changes) {
    const raw = change.value.replace(/\n$/, "").split("\n");
    const type = change.added
      ? "added"
      : change.removed
        ? "removed"
        : "context";
    for (const text of raw) {
      allLines.push({ type, text });
    }
  }

  // Find indices of changed lines
  const changedIndices = new Set<number>();
  for (let i = 0; i < allLines.length; i++) {
    if (allLines[i].type !== "context") {
      changedIndices.add(i);
    }
  }

  if (changedIndices.size === 0) {
    return chalk.dim("  (no changes)");
  }

  // Mark which lines to show (changed lines + context window)
  const visible = new Set<number>();
  for (const idx of changedIndices) {
    for (
      let i = Math.max(0, idx - CONTEXT_LINES);
      i <= Math.min(allLines.length - 1, idx + CONTEXT_LINES);
      i++
    ) {
      visible.add(i);
    }
  }

  // Build output with gap indicators
  const output: string[] = [];
  let lastShown = -1;

  for (let i = 0; i < allLines.length; i++) {
    if (!visible.has(i)) continue;

    // Insert gap indicator if we skipped lines
    const gap = i - lastShown - 1;
    if (gap > 0) {
      output.push(chalk.dim(`  ... ${gap} more lines ...`));
    }

    const { type, text } = allLines[i];
    if (type === "added") {
      output.push(chalk.green(`+ ${text}`));
    } else if (type === "removed") {
      output.push(chalk.red(`- ${text}`));
    } else {
      output.push(chalk.dim(`  ${text}`));
    }

    lastShown = i;
  }

  // Trailing gap if file continues after last visible line
  const trailingGap = allLines.length - 1 - lastShown;
  if (trailingGap > 0) {
    output.push(chalk.dim(`  ... ${trailingGap} more lines ...`));
  }

  return output.join("\n");
}

/** Format new file content as all-additions diff. */
export function formatNewFile(content: string): string {
  const raw = content.replace(/\n$/, "").split("\n");
  const lines = raw.map((line) => chalk.green(`+ ${line}`));

  if (lines.length > MAX_NEW_FILE_LINES) {
    const truncated = lines.slice(0, MAX_NEW_FILE_LINES);
    truncated.push(
      chalk.dim(`  ... ${lines.length - MAX_NEW_FILE_LINES} more lines`),
    );
    return truncated.join("\n");
  }

  return lines.join("\n");
}
