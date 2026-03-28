import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { getErrorMessage } from "../errors";
import { withFilePermission } from "../permissions";
import { formatDiff } from "./format-diff";
import { registerTool } from "./registry";
import { parseToolArgs, type ToolContext } from "./types";

const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  old_string: z.string().min(1, "old_string must not be empty"),
  new_string: z.string(),
});

function performEdit(filePath: string, content: string): string {
  try {
    writeFileSync(filePath, content, "utf-8");
    return `Successfully edited ${filePath}`;
  } catch (err) {
    return `Error writing file: ${getErrorMessage(err)}`;
  }
}

registerTool({
  name: "edit_file",
  displayName: "Edit File",
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
    const parsed = parseToolArgs(argsSchema, args);
    const { old_string: oldString, new_string: newString } = parsed;

    if (oldString === newString) {
      return "Error: old_string and new_string are identical";
    }

    const filePath = resolve(parsed.path);

    if (!existsSync(filePath)) {
      return `Error: file not found: ${filePath}`;
    }

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (err) {
      return `Error reading file: ${getErrorMessage(err)}`;
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

    return withFilePermission({
      context,
      permission: "write_file",
      filePath,
      execute: () => performEdit(filePath, newContent),
      renderConfirm: () => {
        const diffPreview = formatDiff(content, newContent);
        return context.renderInteractive((onResult) =>
          createElement(WriteFileConfirm, {
            filePath,
            isNewFile: false,
            diffPreview,
            onApprove: () => onResult("approved"),
            onDeny: () => onResult("denied"),
          }),
        );
      },
      denyMessage: "The user denied this edit.",
    });
  },
});
