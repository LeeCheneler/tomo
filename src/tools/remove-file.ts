import { resolve } from "node:path";
import { z } from "zod";
import { fileExists, isDirectory, removeFile } from "../utils/fs";
import { checkPathPermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, ok } from "./types";

/** Zod schema for remove_file arguments. */
const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
});

/** The remove_file tool definition. */
export const removeFileTool: Tool = {
  name: "remove_file",
  displayName: "Remove File",
  description: `Remove a file at the given path.

- Only removes files. Use the remove_dir tool to remove directories.
- Fails if the path does not exist.
- Fails if the path is a directory.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to remove (absolute or relative to cwd)",
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

    if (isDirectory(filePath)) {
      return err(`${filePath} is a directory, use remove_dir instead`);
    }

    if (!fileExists(filePath)) {
      return err(`${filePath} does not exist`);
    }

    const permission = checkPathPermission(
      filePath,
      "remove",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm("Remove file?", {
        label: "Remove file?",
        detail: filePath,
      });
      if (!approved) {
        return denied("The user denied this remove.");
      }
    }

    removeFile(filePath);

    return ok(`Removed ${filePath}`);
  },
};
