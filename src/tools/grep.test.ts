import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./grep";

const tmpDir = resolve(import.meta.dirname, "../../.test-grep-tmp");
const mockContext = {
  renderInteractive: vi.fn().mockResolvedValue("approved"),
  reportProgress: vi.fn(),
  permissions: { read_file: true },
};

/** Initialise a git repo inside tmpDir with committed files. */
function setupGitRepo() {
  execSync("git init", { cwd: tmpDir, stdio: "pipe" });
  execSync("git config user.email test@test.com", {
    cwd: tmpDir,
    stdio: "pipe",
  });
  execSync("git config user.name Test", { cwd: tmpDir, stdio: "pipe" });
  execSync("git add -A && git commit -m init", { cwd: tmpDir, stdio: "pipe" });
}

beforeEach(() => {
  mkdirSync(resolve(tmpDir, "src"), { recursive: true });
  writeFileSync(
    resolve(tmpDir, "readme.md"),
    "# Hello World\nThis is a readme.",
  );
  writeFileSync(
    resolve(tmpDir, "src/index.ts"),
    "export function hello() {\n  return 'world';\n}\n",
  );
  writeFileSync(
    resolve(tmpDir, "src/utils.ts"),
    "export function add(a: number, b: number) {\n  return a + b;\n}\n",
  );
  writeFileSync(
    resolve(tmpDir, "src/app.tsx"),
    "function App() {\n  return <div>Hello</div>;\n}\n",
  );
  vi.clearAllMocks();
  mockContext.renderInteractive.mockResolvedValue("approved");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("grep tool", () => {
  it("is registered as non-interactive", () => {
    const tool = getTool("grep");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("grep");
    expect(tool?.interactive).toBe(false);
  });

  it("finds matching lines with file paths and line numbers", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "function", path: tmpDir }),
      mockContext,
    );

    expect(result).toContain("src/index.ts");
    expect(result).toContain("src/utils.ts");
    expect(result).toContain("src/app.tsx");
    // Should include line numbers
    expect(result).toMatch(/:\d+:/);
  });

  it("supports regex patterns", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "function\\s+hello", path: tmpDir }),
      mockContext,
    );

    expect(result).toContain("src/index.ts");
    expect(result).not.toContain("src/utils.ts");
  });

  it("returns message when no matches found", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "nonexistent_string_xyz", path: tmpDir }),
      mockContext,
    );

    expect(result).toBe("No matches found.");
  });

  it("returns error for empty pattern", async () => {
    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "" }),
      mockContext,
    );

    expect(result).toBe("Error: no search pattern provided");
  });

  it("filters by include glob pattern", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "function", path: tmpDir, include: "*.tsx" }),
      mockContext,
    );

    expect(result).toContain("src/app.tsx");
    expect(result).not.toContain("src/index.ts");
    expect(result).not.toContain("src/utils.ts");
  });

  it("excludes gitignored files by default", async () => {
    writeFileSync(resolve(tmpDir, ".gitignore"), "dist/\n");
    mkdirSync(resolve(tmpDir, "dist"), { recursive: true });
    writeFileSync(resolve(tmpDir, "dist/bundle.js"), "function bundled() {}");
    setupGitRepo();

    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({ pattern: "bundled", path: tmpDir }),
      mockContext,
    );

    expect(result).toBe("No matches found.");
  });

  it("includes gitignored files when gitignore is false", async () => {
    writeFileSync(resolve(tmpDir, ".gitignore"), "dist/\n");
    mkdirSync(resolve(tmpDir, "dist"), { recursive: true });
    writeFileSync(resolve(tmpDir, "dist/bundle.js"), "function bundled() {}");
    setupGitRepo();

    const tool = getTool("grep");
    const result = await tool?.execute(
      JSON.stringify({
        pattern: "bundled",
        path: tmpDir,
        gitignore: false,
      }),
      mockContext,
    );

    expect(result).toContain("bundle.js");
    expect(result).toContain("bundled");
  });

  it("falls back to grep for non-git directories", async () => {
    const nonGitDir = resolve("/tmp/.test-grep-non-git");
    mkdirSync(nonGitDir, { recursive: true });
    writeFileSync(resolve(nonGitDir, "file.ts"), "function fallback() {}");

    try {
      const tool = getTool("grep");
      const ctx = {
        ...mockContext,
        renderInteractive: vi.fn().mockResolvedValue("approved"),
      };
      const result = await tool?.execute(
        JSON.stringify({ pattern: "fallback", path: nonGitDir }),
        ctx,
      );

      expect(result).toContain("file.ts");
      expect(result).toContain("fallback");
    } finally {
      rmSync(nonGitDir, { recursive: true, force: true });
    }
  });

  it("does not prompt when read_file permission is granted and path in cwd", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    await tool?.execute(
      JSON.stringify({ pattern: "hello", path: tmpDir }),
      mockContext,
    );

    expect(mockContext.renderInteractive).not.toHaveBeenCalled();
  });

  it("prompts when read_file permission is not granted", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    const ctx = {
      ...mockContext,
      permissions: { read_file: false },
    };

    await tool?.execute(
      JSON.stringify({ pattern: "hello", path: tmpDir }),
      ctx,
    );

    expect(ctx.renderInteractive).toHaveBeenCalledTimes(1);
  });

  it("returns denial when user denies search", async () => {
    setupGitRepo();
    const tool = getTool("grep");
    const ctx = {
      ...mockContext,
      renderInteractive: vi.fn().mockResolvedValue("denied"),
      permissions: { read_file: false },
    };

    const result = await tool?.execute(
      JSON.stringify({ pattern: "hello", path: tmpDir }),
      ctx,
    );

    expect(result).toBe("The user denied this search.");
  });

  it("prompts for paths outside cwd even with permission granted", async () => {
    const tool = getTool("grep");
    await tool?.execute(
      JSON.stringify({ pattern: "test", path: "/tmp" }),
      mockContext,
    );

    expect(mockContext.renderInteractive).toHaveBeenCalledTimes(1);
  });
});
