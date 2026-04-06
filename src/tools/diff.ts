import { createPatch } from "diff";

/**
 * Generates a unified diff between old and new content.
 * Strips the file header lines (--- and +++) so only hunks remain.
 */
export function unifiedDiff(
  filePath: string,
  oldContent: string,
  newContent: string,
): string {
  const patch = createPatch(filePath, oldContent, newContent, "", "", {
    context: 3,
  });

  // createPatch outputs a header (Index, ===, ---, +++) followed by
  // hunks (the @@ blocks with actual changes). We only want the hunks.
  const lines = patch.split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunk === -1) return "";
  return lines.slice(firstHunk).join("\n").trimEnd();
}

/** Formats new file content as a diff with all lines as additions. */
export function newFileDiff(content: string): string {
  const lines = content.split("\n");
  return lines.map((line) => `+${line}`).join("\n");
}
