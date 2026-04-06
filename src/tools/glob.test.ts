import { execSync } from "node:child_process";
import { globSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isGitRepo } from "../prompt/git-context";
import type { ToolContext } from "./types";
import { globTool } from "./glob";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  globSync: vi.fn(),
}));

vi.mock("../prompt/git-context", () => ({
  isGitRepo: vi.fn(),
}));

/** Builds a ToolContext with sensible defaults for testing. */
function stubContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    permissions: {
      cwdReadFile: true,
      cwdWriteFile: false,
      globalReadFile: false,
      globalWriteFile: false,
    },
    confirm: vi.fn(async () => false),
    signal: new AbortController().signal,
    ...overrides,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("globTool", () => {
  it("has correct name and parameters", () => {
    expect(globTool.name).toBe("glob");
    expect(globTool.parameters).toHaveProperty("properties");
    expect(globTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the pattern argument", () => {
      expect(globTool.formatCall({ pattern: "**/*.ts" })).toBe("**/*.ts");
    });

    it("returns empty string when pattern is missing", () => {
      expect(globTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    it("uses git ls-files in a git repo with gitignore enabled", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execSync)
        .mockReturnValueOnce("src/foo.ts\nsrc/bar.ts\n")
        .mockReturnValueOnce("");

      const result = await globTool.execute(
        { pattern: "**/*.ts" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("src/foo.ts\nsrc/bar.ts");
      expect(execSync).toHaveBeenCalledTimes(2);
    });

    it("falls back to globSync outside a git repo", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(globSync).mockReturnValue(["a.ts", "b.ts"] as never);

      const result = await globTool.execute({ pattern: "*.ts" }, stubContext());

      expect(result.status).toBe("ok");
      expect(result.output).toBe("a.ts\nb.ts");
    });

    it("falls back to globSync when gitignore is false", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(globSync).mockReturnValue(["a.ts"] as never);

      const result = await globTool.execute(
        { pattern: "*.ts", gitignore: false },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("a.ts");
      expect(execSync).not.toHaveBeenCalled();
    });

    it("returns a message when no files match", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(globSync).mockReturnValue([] as never);

      const result = await globTool.execute(
        { pattern: "*.xyz" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("No files matched the pattern.");
    });

    it("returns error when glob throws", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(globSync).mockImplementation(() => {
        throw new Error("bad pattern");
      });

      const result = await globTool.execute(
        { pattern: "[invalid" },
        stubContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("bad pattern");
    });

    it("includes untracked files from git ls-files", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execSync)
        .mockReturnValueOnce("tracked.ts\n")
        .mockReturnValueOnce("untracked.ts\n");

      const result = await globTool.execute(
        { pattern: "**/*.ts" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("tracked.ts");
      expect(result.output).toContain("untracked.ts");
    });

    describe("permissions", () => {
      it("searches without confirmation when cwd read permission granted", async () => {
        vi.mocked(isGitRepo).mockReturnValue(false);
        vi.mocked(globSync).mockReturnValue(["a.ts"] as never);
        const confirm = vi.fn();

        const result = await globTool.execute(
          { pattern: "*.ts" },
          stubContext({ confirm }),
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation when read permission not granted", async () => {
        vi.mocked(isGitRepo).mockReturnValue(false);
        vi.mocked(globSync).mockReturnValue(["a.ts"] as never);
        const confirm = vi.fn(async () => true);

        const result = await globTool.execute(
          { pattern: "*.ts" },
          stubContext({
            permissions: {
              cwdReadFile: false,
              cwdWriteFile: false,
              globalReadFile: false,
              globalWriteFile: false,
            },
            confirm,
          }),
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
      });

      it("returns denied when user rejects confirmation", async () => {
        const confirm = vi.fn(async () => false);

        const result = await globTool.execute(
          { pattern: "*.ts" },
          stubContext({
            permissions: {
              cwdReadFile: false,
              cwdWriteFile: false,
              globalReadFile: false,
              globalWriteFile: false,
            },
            confirm,
          }),
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("denied");
      });
    });
  });
});
