import { resolve } from "node:path";
import { z } from "zod";
import { fileExists, isDirectory, removeDir } from "../utils/fs";
import { checkPathPermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, ok } from "./types";

/** Zod schema for remove_dir arguments. */
const argsSchema = z.object({
  path: z.string().min(1, "no directory path provided"),
  recursive: z.boolean().default(false),
});

/** The remove_dir tool definition. */
export const removeDirTool: Tool = {
  name: "remove_dir",
  displayName: "Remove Directory",
  description: `Remove a directory at the given path.

- Non-recursive by default — fails if the directory is not empty.
- Pass recursive: true to remove the entire tree. Recursive removes ALWAYS prompt for confirmation regardless of permission state; the permission flag only gates the safe single-empty-dir case.
- Only removes directories. Use the remove_file tool to remove files.
- Fails if the path does not exist.
- Fails if the path is a file.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description:
          "The directory path to remove (absolute or relative to cwd)",
      },
      recursive: {
        type: "boolean",
        description:
          "If true, remove the entire tree. Always prompts for confirmation regardless of permissions.",
      },
    },
    required: ["path"],
  },
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    const path = String(args.path ?? "");
    return args.recursive ? `${path} (recursive)` : path;
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const dirPath = resolve(parsed.path);

    if (fileExists(dirPath) && !isDirectory(dirPath)) {
      return err(`${dirPath} is a file, use remove_file instead`);
    }

    if (!isDirectory(dirPath)) {
      return err(`${dirPath} does not exist`);
    }

    if (parsed.recursive) {
      // Recursive removes always prompt, regardless of permission state.
      const approved = await context.confirm("Remove directory?", {
        label: "Remove directory?",
        detail: `${dirPath} (recursive)`,
      });
      if (!approved) {
        return denied("The user denied this remove.");
      }
    } else {
      const permission = checkPathPermission(
        dirPath,
        "removeDir",
        context.permissions,
      );
      if (permission === "needs-confirmation") {
        const approved = await context.confirm("Remove directory?", {
          label: "Remove directory?",
          detail: dirPath,
        });
        if (!approved) {
          return denied("The user denied this remove.");
        }
      }
    }

    try {
      removeDir(dirPath, parsed.recursive);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      if (message.includes("ENOTEMPTY")) {
        return err(
          `${dirPath} is not empty, pass recursive: true to remove the entire tree`,
        );
      }
      return err(message);
    }

    return ok(
      parsed.recursive
        ? `Removed ${dirPath} recursively`
        : `Removed ${dirPath}`,
    );
  },
};
