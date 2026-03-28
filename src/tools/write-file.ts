import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { getErrorMessage } from "../errors";
import { withFilePermission } from "../permissions";
import { formatDiff, formatNewFile } from "./format-diff";
import { registerTool } from "./registry";
import { parseToolArgs, type ToolContext } from "./types";

const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  content: z.string(),
});

function performWrite(filePath: string, content: string): string {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, content, "utf-8");
    return `Successfully wrote to ${filePath}`;
  } catch (err) {
    return `Error writing file: ${getErrorMessage(err)}`;
  }
}

registerTool({
  name: "write_file",
  displayName: "Write File",
  description:
    "Write content to a file. Creates parent directories if needed. The user will be prompted to approve or deny before writing.",
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
  async execute(args: string, context: ToolContext): Promise<string> {
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
      denyMessage: "The user denied this write.",
    });
  },
});
