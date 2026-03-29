import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createElement } from "react";
import { z } from "zod";
import { FileAccessConfirm } from "../components/file-access-confirm";
import { getErrorMessage } from "../errors";
import { isGitRepo } from "../git";
import { withFilePermission } from "../permissions";
import { registerTool } from "./registry";
import { parseToolArgs, type ToolContext } from "./types";

const argsSchema = z.object({
  pattern: z.string().min(1, "no search pattern provided"),
  path: z.string().optional(),
  include: z.string().optional(),
  gitignore: z.boolean().default(true),
});

registerTool({
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
          "Optional directory to search in (absolute or relative to cwd). Defaults to cwd.",
      },
      include: {
        type: "string",
        description:
          "Optional glob pattern to filter files (e.g. '*.ts', '*.{ts,tsx}')",
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
  async execute(args: string, context: ToolContext): Promise<string> {
    const parsed = parseToolArgs(argsSchema, args);
    const { pattern, include, gitignore } = parsed;
    const resolved = parsed.path ? resolve(parsed.path) : process.cwd();
    const isFile = parsed.path
      ? statSync(resolved, { throwIfNoEntry: false })?.isFile()
      : false;
    const searchDir = isFile ? dirname(resolved) : resolved;
    const searchTarget = isFile ? resolved : undefined;

    return withFilePermission({
      context,
      permission: "read_file",
      filePath: searchDir,
      execute: () =>
        runGrep(pattern, searchDir, include, gitignore, searchTarget),
      renderConfirm: () =>
        context.renderInteractive((onResult) =>
          createElement(FileAccessConfirm, {
            filePath: searchDir,
            action: `Search file contents for "${pattern}"?`,
            onApprove: () => onResult("approved"),
            onDeny: () => onResult("denied"),
          }),
        ),
      denyMessage: "The user denied this search.",
    });
  },
});

function runGrep(
  pattern: string,
  cwd: string,
  include: string | undefined,
  gitignore: boolean,
  file?: string,
): string {
  try {
    const useGit = gitignore && isGitRepo(cwd);
    let output: string;

    if (file) {
      // Search a single file directly.
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
        `git grep -n -I -P --untracked ${JSON.stringify(pattern)}${includeArgs}`,
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
      return "No matches found.";
    }
    return lines;
  } catch (err) {
    // grep/git grep exit with code 1 when no matches found
    if (
      err instanceof Error &&
      "status" in err &&
      (err as NodeJS.ErrnoException & { status: number }).status === 1
    ) {
      return "No matches found.";
    }
    return `Error: ${getErrorMessage(err)}`;
  }
}
