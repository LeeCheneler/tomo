import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { createElement } from "react";
import { FileAccessConfirm } from "../components/file-access-confirm";
import { isPathWithinCwd } from "../permissions";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

registerTool({
  name: "grep",
  description:
    "Search file contents by pattern. Returns matching lines with file paths and line numbers. By default, gitignored files are excluded.",
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
    const parsed = JSON.parse(args);
    const pattern: string = parsed.pattern ?? "";
    const rawPath: string | undefined = parsed.path;
    const include: string | undefined = parsed.include;
    const gitignore: boolean = parsed.gitignore ?? true;

    if (!pattern.trim()) {
      return "Error: no search pattern provided";
    }

    const searchDir = rawPath ? resolve(rawPath) : process.cwd();

    // Permission granted and path in cwd — search immediately
    if (context.permissions.read_file && isPathWithinCwd(searchDir)) {
      return runGrep(pattern, searchDir, include, gitignore);
    }

    // Permission not granted or outside cwd — ask for approval
    const approved = await context.renderInteractive((onResult) =>
      createElement(FileAccessConfirm, {
        filePath: searchDir,
        action: `Search file contents for "${pattern}"?`,
        onApprove: () => onResult("approved"),
        onDeny: () => onResult("denied"),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this search.";
    }

    return runGrep(pattern, searchDir, include, gitignore);
  },
});

/** Check whether a directory is inside a git repository. */
function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --is-inside-work-tree", {
      cwd,
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function runGrep(
  pattern: string,
  cwd: string,
  include: string | undefined,
  gitignore: boolean,
): string {
  try {
    const useGit = gitignore && isGitRepo(cwd);
    let output: string;

    if (useGit) {
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
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
