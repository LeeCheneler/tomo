import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { isPathWithinCwd } from "../permissions";
import { formatDiff } from "./format-diff";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

function performEdit(filePath: string, content: string): string {
  try {
    writeFileSync(filePath, content, "utf-8");
    return `Successfully edited ${filePath}`;
  } catch (err) {
    return `Error writing file: ${err instanceof Error ? err.message : String(err)}`;
  }
}

registerTool({
  name: "edit_file",
  description:
    "Make an incremental edit to an existing file by replacing a specific string. The old_string must be unique within the file. The user will be prompted to approve or deny before writing.",
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to edit (absolute or relative to cwd)",
      },
      old_string: {
        type: "string",
        description:
          "The exact string to find and replace. Must be unique within the file.",
      },
      new_string: {
        type: "string",
        description: "The replacement string",
      },
    },
    required: ["path", "old_string", "new_string"],
  },
  async execute(args: string, context: ToolContext): Promise<string> {
    const parsed = JSON.parse(args);
    const rawPath: string = parsed.path ?? "";
    const oldString: string = parsed.old_string ?? "";
    const newString: string = parsed.new_string ?? "";

    if (!rawPath.trim()) {
      return "Error: no file path provided";
    }

    if (!oldString) {
      return "Error: old_string must not be empty";
    }

    if (oldString === newString) {
      return "Error: old_string and new_string are identical";
    }

    const filePath = resolve(rawPath);

    if (!existsSync(filePath)) {
      return `Error: file not found: ${filePath}`;
    }

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      return `Error reading file: ${err instanceof Error ? err.message : String(err)}`;
    }

    // Count occurrences
    const occurrences = content.split(oldString).length - 1;

    if (occurrences === 0) {
      return `Error: old_string not found in ${filePath}`;
    }

    if (occurrences > 1) {
      return `Error: old_string found ${occurrences} times in ${filePath}. It must be unique. Provide more surrounding context to disambiguate.`;
    }

    const newContent = content.replace(oldString, newString);

    // Skip confirmation if permission granted and path is within cwd
    if (context.permissions.edit_file && isPathWithinCwd(filePath)) {
      return performEdit(filePath, newContent);
    }

    const diffPreview = formatDiff(content, newContent);

    const approved = await context.renderInteractive((onResult, onCancel) =>
      createElement(WriteFileConfirm, {
        filePath,
        isNewFile: false,
        diffPreview,
        onApprove: () => onResult("approved"),
        onDeny: () => onCancel(),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this edit.";
    }

    return performEdit(filePath, newContent);
  },
});
