import { dirname, resolve } from "node:path";
import { z } from "zod";
import {
  ensureDir,
  fileExists,
  isDirectory,
  readFile,
  writeFile,
} from "../utils/fs";
import { newFileDiff, unifiedDiff } from "./diff";
import { checkFilePermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, okDiff } from "./types";

/** Zod schema for write_file arguments. */
const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  content: z.string(),
});

/** The write_file tool definition. */
export const writeFileTool: Tool = {
  name: "write_file",
  displayName: "Write File",
  description: `Create or overwrite a file at the given path with the provided content.

- Creates parent directories automatically if they don't exist.
- You MUST read a file before overwriting it. Never overwrite a file you have not read in the current conversation.
- Prefer the edit_file tool for small, targeted changes to existing files. Use write_file only for new files or full rewrites.
- Cannot write to a path that is an existing directory.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to write (absolute or relative to cwd)",
      },
      content: {
        type: "string",
        description: "The full content to write to the file",
      },
    },
    required: ["path", "content"],
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

    const existed = fileExists(filePath);
    const oldContent = existed ? readFile(filePath) : "";
    const diff = existed
      ? unifiedDiff(filePath, oldContent, parsed.content)
      : newFileDiff(parsed.content);

    const permission = checkFilePermission(
      filePath,
      "write",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm(`Write file: ${filePath}?`, {
        diff,
      });
      if (!approved) {
        return denied("The user denied this write.");
      }
    }

    ensureDir(dirname(filePath));
    writeFile(filePath, parsed.content);

    return okDiff(diff);
  },
};
