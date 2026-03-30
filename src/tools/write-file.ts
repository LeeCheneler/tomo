import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { getErrorMessage } from "../errors";
import { withFilePermission } from "../permissions";
import { formatDiff, formatNewFile } from "./format-diff";
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
  content: z.string(),
});

function performWrite(filePath: string, content: string): ToolResult {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    return ok(`Successfully wrote to ${filePath}`);
  } catch (e) {
    return err(`Error writing file: ${getErrorMessage(e)}`);
  }
}

registerTool({
  name: "write_file",
  displayName: "Write File",
  description: `Write content to a file, creating it if it doesn't exist or overwriting it completely if it does. Parent directories are created automatically.

- For modifying existing files, prefer edit_file — it is safer and only changes what needs to change.
- Only use write_file for creating new files or when the changes are so extensive that edit_file would be impractical.
- You MUST read an existing file before overwriting it, to understand what you are replacing.
- Do not use shell commands like echo or cat heredocs to write files — use this tool instead.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to write (absolute or relative to cwd)",
      },
      content: {
        type: "string",
        description: "The content to write to the file",
      },
    },
    required: ["path", "content"],
  },
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const parsed = parseToolArgs(argsSchema, args);
    const { content } = parsed;
    const filePath = resolve(parsed.path);

    return withFilePermission({
      context,
      permission: "write_file",
      filePath,
      execute: () => performWrite(filePath, content),
      renderConfirm: () => {
        const isNewFile = !existsSync(filePath);
        const diffPreview = isNewFile
          ? formatNewFile(content)
          : formatDiff(readFileSync(filePath, "utf-8"), content);

        return context.renderInteractive((onResult) =>
          createElement(WriteFileConfirm, {
            filePath,
            isNewFile,
            diffPreview,
            onApprove: () => onResult("approved"),
            onDeny: () => onResult("denied"),
          }),
        );
      },
      denyMessage: denied("The user denied this write."),
    });
  },
});
