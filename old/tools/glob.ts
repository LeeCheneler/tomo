import { execSync } from "node:child_process";
import { globSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { FileAccessConfirm } from "../components/file-access-confirm";
import { getErrorMessage } from "../errors";
import { isGitRepo } from "../git";
import { withFilePermission } from "../permissions";
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
  pattern: z.string().min(1, "no glob pattern provided"),
  path: z.string().optional(),
  gitignore: z.boolean().default(true),
});

registerTool({
  name: "glob",
  displayName: "Glob",
  description: `Find files matching a glob pattern. Returns matching file paths, one per line.

Pattern examples:
- "**/*.ts" — all TypeScript files recursively
- "src/**/*.test.ts" — test files under src/
- "*.json" — JSON files in the search directory
- "src/**/index.ts" — all index files under src/

Respects .gitignore by default (set gitignore to false to include ignored files). Returns "No files matched the pattern." when nothing matches.

Use this tool instead of shell commands like find or ls. For searching file *contents* use grep instead.`,
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description:
          "The glob pattern to match (e.g. **/*.ts, src/**/*.test.ts)",
      },
      path: {
        type: "string",
        description:
          "Optional directory to search in (absolute or relative to cwd). Defaults to cwd.",
      },
      gitignore: {
        type: "boolean",
        description:
          "Whether to respect .gitignore rules and exclude ignored files. Defaults to true. Set to false to include gitignored files.",
      },
    },
    required: ["pattern"],
  },
  interactive: false,
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const parsed = parseToolArgs(argsSchema, args);
    const { pattern, gitignore } = parsed;
    const searchDir = parsed.path ? resolve(parsed.path) : process.cwd();

    return withFilePermission({
      context,
      permission: "read_file",
      filePath: searchDir,
      execute: () => runGlob(pattern, searchDir, gitignore),
      renderConfirm: () =>
        context.renderInteractive((onResult) =>
          createElement(FileAccessConfirm, {
            filePath: searchDir,
            action: `Search for files matching "${pattern}"?`,
            onApprove: () => onResult("approved"),
            onDeny: () => onResult("denied"),
          }),
        ),
      denyMessage: denied("The user denied this search."),
    });
  },
});

/**
 * Use `git ls-files` to list tracked + untracked-but-not-ignored files
 * matching the pattern. Falls back to `fs.globSync` if not in a git repo.
 */
function gitGlob(pattern: string, cwd: string): string[] {
  // Use :(glob) pathspec prefix so git interprets ** as recursive match
  const pathspec = `:(glob)${pattern}`;
  // tracked files matching the pattern
  const tracked = execSync(`git ls-files -- ${JSON.stringify(pathspec)}`, {
    cwd,
    encoding: "utf-8",
  });
  // untracked files that aren't ignored
  const untracked = execSync(
    `git ls-files --others --exclude-standard -- ${JSON.stringify(pathspec)}`,
    { cwd, encoding: "utf-8" },
  );

  const combined = `${tracked}${untracked}`;
  return combined.split("\n").filter((line) => line.length > 0);
}

function runGlob(pattern: string, cwd: string, gitignore: boolean): ToolResult {
  try {
    const matches =
      gitignore && isGitRepo(cwd)
        ? gitGlob(pattern, cwd)
        : globSync(pattern, { cwd });

    if (matches.length === 0) {
      return ok("No files matched the pattern.");
    }
    return ok(matches.join("\n"));
  } catch (e) {
    return err(`${getErrorMessage(e)}`);
  }
}
