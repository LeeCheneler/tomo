import { resolve } from "node:path";
import { z } from "zod";
import { fileExists, isDirectory, readFile } from "../utils/fs";
import { checkFilePermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, ok } from "./types";

/** Maximum number of lines returned before truncation. */
const MAX_LINES = 500;

/** Zod schema for read_file arguments. */
const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
});

/** Formats lines with line numbers (e.g. "  42 | content"). */
function numberLines(lines: string[], startAt: number): string {
  return lines
    .map((line, i) => `${String(startAt + i).padStart(4)} | ${line}`)
    .join("\n");
}

/** Reads a file and returns formatted output with line numbers. */
function readFileContent(
  filePath: string,
  startLine?: number,
  endLine?: number,
): ToolResult {
  if (isDirectory(filePath)) {
    return err(`${filePath} is a directory, not a file`);
  }

  if (!fileExists(filePath)) {
    return err(`file not found: ${filePath}`);
  }

  const content = readFile(filePath);
  const allLines = content.split("\n");
  const totalLines = allLines.length;

  // Line range request
  if (startLine !== undefined || endLine !== undefined) {
    const start = Math.max(1, startLine ?? 1);
    const end = Math.min(totalLines, endLine ?? totalLines);
    const slice = allLines.slice(start - 1, end);
    return ok(numberLines(slice, start));
  }

  // Full file — truncate if needed
  if (totalLines > MAX_LINES) {
    const slice = allLines.slice(0, MAX_LINES);
    return ok(numberLines(slice, 1));
  }

  return ok(numberLines(allLines, 1));
}

/** The read_file tool definition. */
export const readFileTool: Tool = {
  name: "read_file",
  displayName: "Read File",
  description: `Read the contents of a file at the given path. Returns the file content with numbered lines in the format "  42 | content".

- Files over ${MAX_LINES} lines are automatically truncated. Use startLine and endLine to read specific ranges of large files.
- You MUST read a file before editing or overwriting it. Never edit a file you have not read in the current conversation.
- Use this tool instead of shell commands like cat, head, or tail.
- Cannot read directories — use glob to list directory contents instead.
- The line number prefix (e.g. "  42 | ") is display formatting only and is NOT part of the actual file content.`,
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
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    return String(args.path ?? "");
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const filePath = resolve(parsed.path);

    const permission = checkFilePermission(
      filePath,
      "read",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm("Read file?", {
        label: "Read file?",
        detail: filePath,
      });
      if (!approved) {
        return denied("The user denied this read.");
      }
    }

    return readFileContent(filePath, parsed.startLine, parsed.endLine);
  },
};
