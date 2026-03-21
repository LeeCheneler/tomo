import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import React from "react";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { formatDiff, formatNewFile } from "./format-diff";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

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
    const isNewFile = !existsSync(filePath);

    let diffPreview: string;
    if (isNewFile) {
      diffPreview = formatNewFile(content);
    } else {
      const existing = readFileSync(filePath, "utf-8");
      diffPreview = formatDiff(existing, content);
    }

    const approved = await context.renderInteractive((onResult, onCancel) =>
      React.createElement(WriteFileConfirm, {
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

    try {
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, content, "utf-8");
      return `Successfully wrote to ${filePath}`;
    } catch (err) {
      return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
