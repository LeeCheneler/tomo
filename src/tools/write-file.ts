import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { isPathWithinCwd } from "../permissions";
import { formatDiff, formatNewFile } from "./format-diff";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

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
    const parsed = JSON.parse(args);
    const rawPath: string = parsed.path ?? "";
    const content: string = parsed.content ?? "";

    if (!rawPath.trim()) {
      return "Error: no file path provided";
    }

    const filePath = resolve(rawPath);

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

    const approved = await context.renderInteractive((onResult, onCancel) =>
      createElement(WriteFileConfirm, {
        filePath,
        isNewFile,
        diffPreview,
        onApprove: () => onResult("approved"),
        onDeny: () => onCancel(),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this write.";
    }

    return performWrite(filePath, content);
  },
});
