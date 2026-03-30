import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";
import { makeMockContext } from "./test-helpers";

// Import to trigger registration
import "./glob";

const tmpDir = resolve(import.meta.dirname, "../../.test-glob-tmp");
let mockContext = makeMockContext();

/** Initialise a git repo inside tmpDir with a .gitignore and committed + ignored files. */
function setupGitRepo() {
  execSync("git init", { cwd: tmpDir, stdio: "pipe" });
  execSync("git config user.email test@test.com", {
    cwd: tmpDir,
    stdio: "pipe",
  });
  execSync("git config user.name Test", { cwd: tmpDir, stdio: "pipe" });
  writeFileSync(resolve(tmpDir, ".gitignore"), "dist/\n");
  mkdirSync(resolve(tmpDir, "dist"), { recursive: true });
  writeFileSync(resolve(tmpDir, "dist/bundle.js"), "// built");
  execSync("git add -A && git commit -m init", { cwd: tmpDir, stdio: "pipe" });
}

beforeEach(() => {
  mkdirSync(resolve(tmpDir, "src"), { recursive: true });
  writeFileSync(resolve(tmpDir, "readme.md"), "# Hello");
  writeFileSync(resolve(tmpDir, "src/index.ts"), "export {}");
  writeFileSync(resolve(tmpDir, "src/app.tsx"), "<App />");
  writeFileSync(resolve(tmpDir, "src/utils.test.ts"), "test()");
  vi.clearAllMocks();
  mockContext = makeMockContext();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("glob tool", () => {
  it("is registered as non-interactive", () => {
    const tool = getTool("glob");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("glob");
    expect(tool?.interactive).toBe(false);
  });

  it("matches files by pattern", async () => {
    const tool = getTool("glob");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.ts", path: tmpDir }),
      mockContext,
    );

    expect(result?.output).toContain("src/index.ts");
    expect(result?.output).toContain("src/utils.test.ts");
    expect(result?.output).not.toContain("readme.md");
    expect(result?.output).not.toContain("app.tsx");
  });

  it("matches files with tsx extension", async () => {
    const tool = getTool("glob");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.tsx", path: tmpDir }),
      mockContext,
    );

    expect(result?.output).toContain("src/app.tsx");
    expect(result?.output).not.toContain("index.ts");
  });

  it("returns message when no files match", async () => {
    const tool = getTool("glob");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.go", path: tmpDir }),
      mockContext,
    );

    expect(result?.output).toBe("No files matched the pattern.");
  });

  it("throws for empty pattern", async () => {
    const tool = getTool("glob");
    await expect(
      tool?.execute(JSON.stringify({ pattern: "" }), mockContext),
    ).rejects.toThrow("no glob pattern provided");
  });

  it("defaults to cwd when no path provided", async () => {
    const tool = getTool("glob");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "package.json" }),
      mockContext,
    );

    // Running from project root, should find the project's package.json
    expect(result?.output).toContain("package.json");
  });

  it("does not prompt when read_file permission is granted and path in cwd", async () => {
    const tool = getTool("glob");
    await tool?.execute(
      JSON.stringify({ pattern: "**/*.ts", path: tmpDir }),
      mockContext,
    );

    expect(mockContext.renderInteractive).not.toHaveBeenCalled();
  });

  it("prompts when read_file permission is not granted", async () => {
    const tool = getTool("glob");
    const ctx = {
      ...mockContext,
      permissions: { read_file: false },
    };

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.ts", path: tmpDir }),
      ctx,
    );

    expect(ctx.renderInteractive).toHaveBeenCalledTimes(1);
    expect(result?.output).toContain("src/index.ts");
  });

  it("returns denial when user denies search", async () => {
    const tool = getTool("glob");
    const ctx = {
      ...mockContext,
      renderInteractive: vi.fn().mockResolvedValue("denied"),
      permissions: { read_file: false },
    };

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.ts", path: tmpDir }),
      ctx,
    );

    expect(result?.output).toBe("The user denied this search.");
  });

  it("prompts for paths outside cwd even with permission granted", async () => {
    const tool = getTool("glob");

    await tool?.execute(
      JSON.stringify({ pattern: "*.txt", path: "/tmp" }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
  });

  it("excludes gitignored files by default", async () => {
    setupGitRepo();
    const tool = getTool("glob");

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.js", path: tmpDir }),
      mockContext,
    );

    expect(result?.output).toBe("No files matched the pattern.");
  });

  it("excludes gitignored files when gitignore is true", async () => {
    setupGitRepo();
    const tool = getTool("glob");

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.js", path: tmpDir, gitignore: true }),
      mockContext,
    );

    expect(result?.output).toBe("No files matched the pattern.");
  });

  it("includes gitignored files when gitignore is false", async () => {
    setupGitRepo();
    const tool = getTool("glob");

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.js", path: tmpDir, gitignore: false }),
      mockContext,
    );

    expect(result?.output).toContain("dist/bundle.js");
  });

  it("includes untracked non-ignored files with gitignore on", async () => {
    setupGitRepo();
    // Add a new file that isn't committed yet but also isn't ignored
    writeFileSync(resolve(tmpDir, "src/new.ts"), "// new");
    const tool = getTool("glob");

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.ts", path: tmpDir }),
      mockContext,
    );

    expect(result?.output).toContain("src/index.ts");
    expect(result?.output).toContain("src/new.ts");
  });

  it("falls back to fs.globSync for non-git directories", async () => {
    // tmpDir is not a git repo (no setupGitRepo call)
    const tool = getTool("glob");

    const result = await tool?.execute(
      JSON.stringify({ pattern: "**/*.ts", path: tmpDir }),
      mockContext,
    );

    expect(result?.output).toContain("src/index.ts");
    expect(result?.output).toContain("src/utils.test.ts");
  });
});
