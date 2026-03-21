import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { registerTool } from "./registry";

const MAX_LINES = 500;

registerTool({
  name: "read_file",
  description:
    "Read the contents of a file. Returns the file content as text. Non-interactive — does not require user confirmation.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to read (absolute or relative to cwd)",
      },
      startLine: {
        type: "number",
        description:
          "Optional 1-based start line for reading a range (inclusive)",
      },
      endLine: {
        type: "number",
        description:
          "Optional 1-based end line for reading a range (inclusive)",
      },
    },
    required: ["path"],
  },
  interactive: false,
  async execute(args: string): Promise<string> {
    const parsed = JSON.parse(args);
    const rawPath: string = parsed.path ?? "";
    const startLine: number | undefined = parsed.startLine;
    const endLine: number | undefined = parsed.endLine;

    if (!rawPath.trim()) {
      return "Error: no file path provided";
    }

    const filePath = resolve(rawPath);

    try {
      const stat = statSync(filePath);
      if (stat.isDirectory()) {
        return `Error: ${filePath} is a directory, not a file`;
      }
    } catch {
      return `Error: file not found: ${filePath}`;
    }

    try {
      const content = readFileSync(filePath, "utf-8");
      const allLines = content.split("\n");
      const totalLines = allLines.length;

      // Line range request
      if (startLine !== undefined || endLine !== undefined) {
        const start = Math.max(1, startLine ?? 1);
        const end = Math.min(totalLines, endLine ?? totalLines);
        const slice = allLines.slice(start - 1, end);
        const numbered = slice.map(
          (line, i) => `${String(start + i).padStart(4)} | ${line}`,
        );
        return `${filePath} (lines ${start}-${end} of ${totalLines})\n${numbered.join("\n")}`;
      }

      // Full file — truncate if needed
      if (totalLines > MAX_LINES) {
        const slice = allLines.slice(0, MAX_LINES);
        const numbered = slice.map(
          (line, i) => `${String(i + 1).padStart(4)} | ${line}`,
        );
        return `${filePath} (showing first ${MAX_LINES} of ${totalLines} lines, truncated)\n${numbered.join("\n")}`;
      }

      const numbered = allLines.map(
        (line, i) => `${String(i + 1).padStart(4)} | ${line}`,
      );
      return `${filePath} (${totalLines} lines)\n${numbered.join("\n")}`;
    } catch (err) {
      return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
