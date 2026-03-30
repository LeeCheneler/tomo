import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { FileAccessConfirm } from "../components/file-access-confirm";
import { getErrorMessage } from "../errors";
import { withFilePermission } from "../permissions";
import { registerTool } from "./registry";
import {
  denied,
  err,
  ok,
  parseToolArgs,
  type ToolContext,
  type ToolResult,
} from "./types";

const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  startLine: z.number().optional(),
  endLine: z.number().optional(),
});

const MAX_LINES = 500;

function readFile(
  filePath: string,
  startLine?: number,
  endLine?: number,
): ToolResult {
  try {
    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      return err(`${filePath} is a directory, not a file`);
    }
  } catch {
    return err(`file not found: ${filePath}`);
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
      return ok(
        `${filePath} (lines ${start}-${end} of ${totalLines})\n${numbered.join("\n")}`,
      );
    }

    // Full file — truncate if needed
    if (totalLines > MAX_LINES) {
      const slice = allLines.slice(0, MAX_LINES);
      const numbered = slice.map(
        (line, i) => `${String(i + 1).padStart(4)} | ${line}`,
      );
      return ok(
        `${filePath} (showing first ${MAX_LINES} of ${totalLines} lines, truncated)\n${numbered.join("\n")}`,
      );
    }

    const numbered = allLines.map(
      (line, i) => `${String(i + 1).padStart(4)} | ${line}`,
    );
    return ok(`${filePath} (${totalLines} lines)\n${numbered.join("\n")}`);
  } catch (e) {
    return err(`Error reading file: ${getErrorMessage(e)}`);
  }
}

registerTool({
  name: "read_file",
  displayName: "Read File",
  description: `Read the contents of a file at the given path. Returns the file content with numbered lines in the format "  42 | content".

- Files over ${MAX_LINES} lines are automatically truncated. Use startLine and endLine to read specific ranges of large files.
- You MUST read a file before editing or overwriting it. Never edit a file you have not read in the current conversation.
- Use this tool instead of shell commands like cat, head, or tail.
- Cannot read directories — use glob to list directory contents instead.
- The line number prefix (e.g. "  42 | ") is display formatting only and is NOT part of the actual file content. When using file content in other tools, strip the prefix.`,
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
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const parsed = parseToolArgs(argsSchema, args);
    const { startLine, endLine } = parsed;
    const filePath = resolve(parsed.path);

    return withFilePermission({
      context,
      permission: "read_file",
      filePath,
      execute: () => readFile(filePath, startLine, endLine),
      renderConfirm: () =>
        context.renderInteractive((onResult) =>
          createElement(FileAccessConfirm, {
            filePath,
            action: "Read this file?",
            onApprove: () => onResult("approved"),
            onDeny: () => onResult("denied"),
          }),
        ),
      denyMessage: denied("The user denied this read."),
    });
  },
});
