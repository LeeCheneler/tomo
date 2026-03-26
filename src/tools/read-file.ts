import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { FileAccessConfirm } from "../components/file-access-confirm";
import { isPathWithinCwd } from "../permissions";
import { registerTool } from "./registry";
import { type ToolContext, parseToolArgs } from "./types";

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
): string {
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
}

registerTool({
  name: "read_file",
  displayName: "Read File",
  description: "Read the contents of a file. Returns the file content as text.",
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
  async execute(args: string, context: ToolContext): Promise<string> {
    const parsed = parseToolArgs(argsSchema, args);
    const { startLine, endLine } = parsed;

    const filePath = resolve(parsed.path);

    // Permission granted and path in cwd — read immediately
    if (context.permissions.read_file && isPathWithinCwd(filePath)) {
      return readFile(filePath, startLine, endLine);
    }

    // Permission not granted or outside cwd — ask for approval
    const approved = await context.renderInteractive((onResult, _onCancel) =>
      createElement(FileAccessConfirm, {
        filePath,
        action: "Read this file?",
        onApprove: () => onResult("approved"),
        onDeny: () => onResult("denied"),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this read.";
    }

    return readFile(filePath, startLine, endLine);
  },
});
