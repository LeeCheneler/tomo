import { resolve } from "node:path";
import { z } from "zod";
import { fileExists, isDirectory, readFile, writeFile } from "../utils/fs";
import { unifiedDiff } from "./diff";
import { checkFilePermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, okDiff } from "./types";

/** Zod schema for edit_file arguments. */
const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  oldString: z.string().min(1, "oldString must not be empty"),
  newString: z.string(),
});

/** The edit_file tool definition. */
export const editFileTool: Tool = {
  name: "edit_file",
  displayName: "Edit File",
  description: `Replace an exact string match in a file with new content.

- The oldString must appear exactly once in the file. If it appears zero or multiple times, the edit fails.
- You MUST read the file before editing it. Never edit a file you have not read in the current conversation.
- Use this tool for small, targeted changes. Use write_file for full rewrites or new files.
- The oldString and newString must be different.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to edit (absolute or relative to cwd)",
      },
      oldString: {
        type: "string",
        description: "The exact string to find and replace (must be unique)",
      },
      newString: {
        type: "string",
        description: "The replacement string",
      },
    },
    required: ["path", "oldString", "newString"],
  },
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    return String(args.path ?? "");
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const filePath = resolve(parsed.path);

    if (isDirectory(filePath)) {
      return err(`${filePath} is a directory, not a file`);
    }

    if (!fileExists(filePath)) {
      return err(`file not found: ${filePath}`);
    }

    const content = readFile(filePath);

    if (parsed.oldString === parsed.newString) {
      return err("oldString and newString are identical");
    }

    const occurrences = content.split(parsed.oldString).length - 1;
    if (occurrences === 0) {
      return err("oldString not found in file");
    }
    if (occurrences > 1) {
      return err(
        `oldString found ${occurrences} times — it must be unique. Add surrounding context to disambiguate.`,
      );
    }

    const newContent = content.replace(parsed.oldString, parsed.newString);
    const diff = unifiedDiff(filePath, content, newContent);

    const permission = checkFilePermission(
      filePath,
      "write",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm(`Edit file: ${filePath}?`, {
        diff,
      });
      if (!approved) {
        return denied("The user denied this edit.");
      }
    }

    writeFile(filePath, newContent);

    return okDiff(diff);
  },
};
