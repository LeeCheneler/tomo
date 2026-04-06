import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { z } from "zod";
import { isGitRepo } from "../prompt/git-context";
import { checkFilePermission } from "./permissions";
import type { Tool, ToolContext, ToolResult } from "./types";
import { denied, err, ok } from "./types";

/** Zod schema for grep arguments. */
const argsSchema = z.object({
  pattern: z.string().min(1, "no search pattern provided"),
  path: z.string().optional(),
  include: z.string().optional(),
  gitignore: z.boolean().default(true),
});

/** Runs grep and returns the result. */
function runGrep(
  pattern: string,
  cwd: string,
  include: string | undefined,
  gitignore: boolean,
  file?: string,
): ToolResult {
  try {
    const useGit = gitignore && isGitRepo(cwd);
    let output: string;

    if (file) {
      output = execSync(
        `grep -n -E ${JSON.stringify(pattern)} ${JSON.stringify(file)}`,
        { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
    } else if (useGit) {
      // Auto-prepend **/ so bare globs like *.ts match in subdirectories
      const globInclude = include?.includes("/") ? include : `**/${include}`;
      const includeArgs = include
        ? ` -- ${JSON.stringify(`:(glob)${globInclude}`)}`
        : "";
      output = execSync(
        `git grep -n -I -E --untracked ${JSON.stringify(pattern)}${includeArgs}`,
        { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
    } else {
      const includeArgs = include
        ? ` --include=${JSON.stringify(include)}`
        : "";
      output = execSync(
        `grep -rn -E ${JSON.stringify(pattern)}${includeArgs} .`,
        { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] },
      );
    }

    const lines = output.trimEnd();
    if (!lines) {
      return ok("No matches found.");
    }
    return ok(lines);
  } catch (e) {
    // grep/git grep exit with code 1 when no matches found
    if (
      e instanceof Error &&
      "status" in e &&
      (e as NodeJS.ErrnoException & { status: number }).status === 1
    ) {
      return ok("No matches found.");
    }
    return err(e instanceof Error ? e.message : "unknown error");
  }
}

/** The grep tool definition. */
export const grepTool: Tool = {
  name: "grep",
  displayName: "Grep",
  description: `Search file contents using regex patterns. Returns matching lines in the format "file:line_number:content".

- Supports full regex syntax (e.g. "TODO", "function\\s+\\w+", "import.*from").
- Use the include parameter to filter by file type (e.g. "*.ts", "*.{ts,tsx}").
- Respects .gitignore by default (set gitignore to false to include ignored files).
- Returns "No matches found." when nothing matches.

Use this tool instead of shell commands like grep or rg. For finding files by *name* use glob instead.

Effective search patterns:
- Find definitions: "function\\s+methodName", "class\\s+ClassName", "const\\s+varName"
- Find imports: "import.*moduleName"
- Find usages: "methodName\\("`,
  parameters: {
    type: "object",
    properties: {
      pattern: {
        type: "string",
        description:
          "The search pattern (supports regex, e.g. 'TODO', 'function\\s+\\w+')",
      },
      path: {
        type: "string",
        description:
          "Optional file or directory to search in (absolute or relative to cwd). Defaults to cwd.",
      },
      include: {
        type: "string",
        description:
          "Optional glob pattern to filter files (e.g. '*.ts', '*.{ts,tsx}')",
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
    const resolved = parsed.path ? resolve(parsed.path) : process.cwd();
    const isFile = parsed.path
      ? statSync(resolved, { throwIfNoEntry: false })?.isFile()
      : false;
    const searchDir = isFile ? dirname(resolved) : resolved;
    const searchTarget = isFile ? resolved : undefined;

    const permission = checkFilePermission(
      searchDir,
      "read",
      context.permissions,
    );

    if (permission === "needs-confirmation") {
      const approved = await context.confirm(
        `Search file contents for "${parsed.pattern}" in ${searchDir}?`,
      );
      if (!approved) {
        return denied("The user denied this search.");
      }
    }

    return runGrep(
      parsed.pattern,
      searchDir,
      parsed.include,
      parsed.gitignore,
      searchTarget,
    );
  },
};
