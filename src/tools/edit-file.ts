import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { WriteFileConfirm } from "../components/write-file-confirm";
import { getErrorMessage } from "../errors";
import { withFilePermission } from "../permissions";
import { formatDiff } from "./format-diff";
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
  old_string: z.string().min(1, "old_string must not be empty"),
  new_string: z.string(),
});

function performEdit(filePath: string, content: string): ToolResult {
  try {
    writeFileSync(filePath, content, "utf-8");
    return ok(`Successfully edited ${filePath}`);
  } catch (e) {
    return err(`Error writing file: ${getErrorMessage(e)}`);
  }
}

registerTool({
  name: "edit_file",
  displayName: "Edit File",
  description: `Make a targeted edit to a file by replacing an exact string match. The old_string must appear exactly once in the file.

CRITICAL — old_string must be an exact, character-for-character match:
- Copy the text precisely from the file content you read — do not type it from memory.
- Preserve all whitespace exactly: indentation (tabs vs spaces), trailing spaces, and blank lines.
- Do NOT include line number prefixes (e.g. "  42 | ") from read_file output — those are not part of the file.
- old_string and new_string must be different.

If the edit fails:
- "old_string not found" — Re-read the file and copy the exact text again. Do not retry from memory.
- "old_string found N times" — Include more surrounding lines in old_string to make it unique.

To delete text, set new_string to an empty string. Prefer this tool over write_file for modifications — only use write_file when creating new files or performing a complete rewrite.`,
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
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const parsed = parseToolArgs(argsSchema, args);
    const { old_string: oldString, new_string: newString } = parsed;

    if (oldString === newString) {
      return err("old_string and new_string are identical");
    }

    const filePath = resolve(parsed.path);

    if (!existsSync(filePath)) {
      return err(`file not found: ${filePath}`);
    }

    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch (e) {
      return err(`Error reading file: ${getErrorMessage(e)}`);
    }

    // Count occurrences
    const occurrences = content.split(oldString).length - 1;

    if (occurrences === 0) {
      return err(`old_string not found in ${filePath}`);
    }

    if (occurrences > 1) {
      return err(
        `old_string found ${occurrences} times in ${filePath}. It must be unique. Provide more surrounding context to disambiguate.`,
      );
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
      denyMessage: denied("The user denied this edit."),
    });
  },
});
