import { resolve } from "node:path";
import { z } from "zod";
import { fileExists, isDirectory, readFile, writeFile } from "../utils/fs";
import { unifiedDiff } from "./diff";
import { checkPathPermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, okDiff } from "./types";

/** Zod schema for a single edit within an edit_file call. */
const editSchema = z.object({
  oldString: z.string().min(1, "oldString must not be empty"),
  newString: z.string(),
  replaceAll: z.boolean().default(false),
});

/** Zod schema for edit_file arguments. */
const argsSchema = z.object({
  path: z.string().min(1, "no file path provided"),
  edits: z.array(editSchema).min(1, "at least one edit is required"),
});

/** A single edit entry after schema parsing. */
type Edit = z.infer<typeof editSchema>;

/** Result of applying the edits sequentially to a file's content. */
type ApplyResult =
  | { ok: true; content: string }
  | { ok: false; message: string };

/** Applies edits sequentially to the given content, in memory. */
function applyEdits(original: string, edits: readonly Edit[]): ApplyResult {
  let working = original;

  for (let i = 0; i < edits.length; i++) {
    const edit = edits[i];
    const label = `edit ${i + 1}`;

    if (edit.oldString === edit.newString) {
      return {
        ok: false,
        message: `${label}: oldString and newString are identical`,
      };
    }

    const occurrences = working.split(edit.oldString).length - 1;

    if (occurrences === 0) {
      return { ok: false, message: `${label}: oldString not found in file` };
    }

    if (occurrences > 1 && !edit.replaceAll) {
      return {
        ok: false,
        message: `${label}: oldString found ${occurrences} times — set replaceAll: true or add surrounding context to disambiguate`,
      };
    }

    working = edit.replaceAll
      ? working.split(edit.oldString).join(edit.newString)
      : working.replace(edit.oldString, edit.newString);
  }

  return { ok: true, content: working };
}

/** The edit_file tool definition. */
export const editFileTool: Tool = {
  name: "edit_file",
  displayName: "Edit File",
  description: `Apply one or more edits to a file in a single atomic call.

- Each edit has an oldString to find, a newString to replace it with, and an optional replaceAll flag (default false).
- When replaceAll is false, oldString must appear exactly once in the current file content. If it appears zero or multiple times, the edit fails.
- When replaceAll is true, every occurrence of oldString is replaced. The edit fails only if oldString appears zero times.
- Edits are applied sequentially: each edit operates on the result of the previous edit, not the original file content. Order matters.
- The whole call is atomic. If any edit fails, the file is not modified and the call returns an error identifying which edit failed.
- Prefer batching multiple edits to the same file in a single call over multiple calls — it is faster and produces a single combined diff for review.
- You MUST read the file before editing it. Never edit a file you have not read in the current conversation.
- Use this tool for targeted changes. Use write_file for full rewrites or new files.
- oldString and newString within an edit must be different.`,
  parameters: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "The file path to edit (absolute or relative to cwd)",
      },
      edits: {
        type: "array",
        description:
          "One or more edits to apply sequentially to the file. Each edit operates on the result of the previous edit.",
        minItems: 1,
        items: {
          type: "object",
          properties: {
            oldString: {
              type: "string",
              description:
                "The exact string to find. Must be unique in the file unless replaceAll is true.",
            },
            newString: {
              type: "string",
              description: "The replacement string",
            },
            replaceAll: {
              type: "boolean",
              description:
                "If true, replace every occurrence of oldString. Default false.",
            },
          },
          required: ["oldString", "newString"],
        },
      },
    },
    required: ["path", "edits"],
  },
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    const path = String(args.path ?? "");
    const edits = args.edits;
    if (Array.isArray(edits) && edits.length > 1) {
      return `${path} (${edits.length} edits)`;
    }
    return path;
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const filePath = resolve(parsed.path);

    if (isDirectory(filePath)) {
      return err(`${filePath} is a directory, not a file`);
    }

    if (!fileExists(filePath)) {
      return err(`file not found: ${filePath}`);
    }

    const original = readFile(filePath);
    const result = applyEdits(original, parsed.edits);

    if (!result.ok) {
      return err(result.message);
    }

    const diff = unifiedDiff(filePath, original, result.content);

    const permission = checkPathPermission(
      filePath,
      "write",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm("Edit file?", {
        label: "Edit file?",
        detail: filePath,
        diff,
      });
      if (!approved) {
        return denied("The user denied this edit.");
      }
    }

    writeFile(filePath, result.content);

    return okDiff(diff);
  },
};
