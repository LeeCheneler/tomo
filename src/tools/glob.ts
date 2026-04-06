import { execFileSync } from "node:child_process";
import { globSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { isGitRepo } from "../prompt/git-context";
import { getErrorMessage } from "../utils/error";
import { checkFilePermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, ok } from "./types";

/** Zod schema for glob arguments. */
const argsSchema = z.object({
  pattern: z.string().min(1, "no glob pattern provided"),
  path: z.string().optional(),
  gitignore: z.boolean().default(true),
});

/**
 * Lists tracked and untracked-but-not-ignored files matching a glob pattern
 * using git ls-files. Falls back to fs.globSync outside a git repo.
 */
function gitGlob(pattern: string, cwd: string): string[] {
  const pathspec = `:(glob)${pattern}`;
  const tracked = execFileSync("git", ["ls-files", "--", pathspec], {
    cwd,
    encoding: "utf-8",
  });
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", pathspec],
    { cwd, encoding: "utf-8" },
  );
  return `${tracked}${untracked}`.split("\n").filter(Boolean);
}

/** Runs the glob and returns the result. */
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
    return err(getErrorMessage(e));
  }
}

/** The glob tool definition. */
export const globTool: Tool = {
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
        description: "Whether to respect .gitignore rules. Defaults to true.",
      },
    },
    required: ["pattern"],
  },
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    return String(args.pattern ?? "");
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const searchDir = parsed.path ? resolve(parsed.path) : process.cwd();

    const permission = checkFilePermission(
      searchDir,
      "read",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm(
        `Search for files matching "${parsed.pattern}" in ${searchDir}?`,
      );
      if (!approved) {
        return denied("The user denied this search.");
      }
    }

    return runGlob(parsed.pattern, searchDir, parsed.gitignore);
  },
};
