import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { isPathWithinCwd } from "../permissions";
import { formatDiff, formatNewFile } from "./format-diff";
import { registerTool } from "./registry";
import { type ToolContext, parseToolArgs } from "./types";

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
    return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
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

    // Skip confirmation if permission granted and path is within cwd
    if (context.permissions.write_file && isPathWithinCwd(filePath)) {
      return performWrite(filePath, content);
    }

    const isNewFile = !existsSync(filePath);

    let diffPreview: string;
    if (isNewFile) {
      diffPreview = formatNewFile(content);
    } else {
      const existing = readFileSync(filePath, "utf-8");
      diffPreview = formatDiff(existing, content);
    }

    const approved = await context.renderInteractive((onResult, _onCancel) =>
      createElement(WriteFileConfirm, {
        filePath,
        isNewFile,
        diffPreview,
        onApprove: () => onResult("approved"),
        onDeny: () => onResult("denied"),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this write.";
    }

    return performWrite(filePath, content);
  },
});
