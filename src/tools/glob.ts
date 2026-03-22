import { execSync } from "node:child_process";
import { globSync } from "node:fs";
import { resolve } from "node:path";
import { createElement } from "react";
import { FileAccessConfirm } from "../components/file-access-confirm";
import { isPathWithinCwd } from "../permissions";
import { registerTool } from "./registry";
import type { ToolContext } from "./types";

registerTool({
  name: "glob",
  description:
    "Find files matching a glob pattern. Returns matching file paths, one per line. By default, gitignored files are excluded.",
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
  async execute(args: string, context: ToolContext): Promise<string> {
    const parsed = JSON.parse(args);
    const pattern: string = parsed.pattern ?? "";
    const rawPath: string | undefined = parsed.path;
    const gitignore: boolean = parsed.gitignore ?? true;

    if (!pattern.trim()) {
      return "Error: no glob pattern provided";
    }

    const searchDir = rawPath ? resolve(rawPath) : process.cwd();

    // Permission granted and path in cwd — search immediately
    if (context.permissions.read_file && isPathWithinCwd(searchDir)) {
      return runGlob(pattern, searchDir, gitignore);
    }

    // Permission not granted or outside cwd — ask for approval
    const approved = await context.renderInteractive((onResult) =>
      createElement(FileAccessConfirm, {
        filePath: searchDir,
        action: `Search for files matching "${pattern}"?`,
        onApprove: () => onResult("approved"),
        onDeny: () => onResult("denied"),
      }),
    );

    if (approved !== "approved") {
      return "The user denied this search.";
    }

    return runGlob(pattern, searchDir, gitignore);
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

/**
 * Use `git ls-files` to list tracked + untracked-but-not-ignored files
 * matching the pattern. Falls back to `fs.globSync` if not in a git repo.
 */
function gitGlob(pattern: string, cwd: string): string[] {
  // tracked files matching the pattern
  const tracked = execSync(`git ls-files -- ${JSON.stringify(pattern)}`, {
    cwd,
    encoding: "utf-8",
  });
  // untracked files that aren't ignored
  const untracked = execSync(
    `git ls-files --others --exclude-standard -- ${JSON.stringify(pattern)}`,
    { cwd, encoding: "utf-8" },
  );

  const combined = `${tracked}${untracked}`;
  return combined.split("\n").filter((line) => line.length > 0);
}

function runGlob(pattern: string, cwd: string, gitignore: boolean): string {
  try {
    const matches =
      gitignore && isGitRepo(cwd)
        ? gitGlob(pattern, cwd)
        : globSync(pattern, { cwd });

    if (matches.length === 0) {
      return "No files matched the pattern.";
    }
    return matches.join("\n");
  } catch (err) {
    return `Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}
