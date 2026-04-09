import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isGitRepo } from "../prompt/git-context";
import { mockToolContext } from "../test-utils/stub-context";
import { grepTool } from "./grep";

vi.mock("node:child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  statSync: vi.fn(() => null),
}));

vi.mock("../prompt/git-context", () => ({
  isGitRepo: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

describe("grepTool", () => {
  it("has correct name and parameters", () => {
    expect(grepTool.name).toBe("grep");
    expect(grepTool.parameters).toHaveProperty("properties");
    expect(grepTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the pattern argument", () => {
      expect(grepTool.formatCall({ pattern: "TODO" })).toBe("TODO");
    });

    it("returns empty string when pattern is missing", () => {
      expect(grepTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    it("uses git grep in a git repo with gitignore enabled", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execFileSync).mockReturnValue("src/foo.ts:10:// TODO fix\n");

      const result = await grepTool.execute(
        { pattern: "TODO" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("src/foo.ts:10:// TODO fix");
      expect(execFileSync).toHaveBeenCalledOnce();
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("git");
      expect(vi.mocked(execFileSync).mock.calls[0]?.[1]).toContain("grep");
    });

    it("uses regular grep outside a git repo", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execFileSync).mockReturnValue("./foo.ts:5:match\n");

      const result = await grepTool.execute(
        { pattern: "match" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("./foo.ts:5:match");
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("grep");
      expect(vi.mocked(execFileSync).mock.calls[0]?.[1]).toContain("-rn");
    });

    it("uses regular grep when gitignore is false", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execFileSync).mockReturnValue("./foo.ts:1:hit\n");

      const result = await grepTool.execute(
        { pattern: "hit", gitignore: false },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("grep");
      expect(vi.mocked(execFileSync).mock.calls[0]?.[1]).toContain("-rn");
    });

    it("passes include filter to git grep", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execFileSync).mockReturnValue("a.ts:1:x\n");

      await grepTool.execute(
        { pattern: "x", include: "*.ts" },
        mockToolContext(),
      );

      const args = vi.mocked(execFileSync).mock.calls[0]?.[1] as string[];
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("git");
      expect(args).toContain("grep");
      expect(args).toContain(":(glob)**/*.ts");
    });

    it("preserves include path with slash for git grep", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execFileSync).mockReturnValue("a.ts:1:x\n");

      await grepTool.execute(
        { pattern: "x", include: "src/**/*.ts" },
        mockToolContext(),
      );

      const args = vi.mocked(execFileSync).mock.calls[0]?.[1] as string[];
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("git");
      expect(args).toContain("grep");
      // Should NOT prepend **/ since the include already has a path
      expect(args).toContain(":(glob)src/**/*.ts");
    });

    it("passes include filter to regular grep", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execFileSync).mockReturnValue("a.ts:1:x\n");

      await grepTool.execute(
        { pattern: "x", include: "*.ts" },
        mockToolContext(),
      );

      const args = vi.mocked(execFileSync).mock.calls[0]?.[1] as string[];
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("grep");
      expect(args).toContain("-rn");
      expect(args).toContain("--include");
      expect(args).toContain("*.ts");
    });

    it("searches a single file when path points to a file", async () => {
      const filePath = resolve("src/foo.ts");
      vi.mocked(statSync).mockReturnValue({ isFile: () => true } as never);
      vi.mocked(execFileSync).mockReturnValue("5:match\n");

      const result = await grepTool.execute(
        { pattern: "match", path: "src/foo.ts" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      const args = vi.mocked(execFileSync).mock.calls[0]?.[1] as string[];
      expect(vi.mocked(execFileSync).mock.calls[0]?.[0]).toBe("grep");
      expect(args).toContain("-n");
      expect(args).toContain(filePath);
    });

    it("returns no matches message when output is empty", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execFileSync).mockReturnValue("");

      const result = await grepTool.execute(
        { pattern: "nothing" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("No matches found.");
    });

    it("returns no matches when grep exits with code 1", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      const exitError = new Error("grep exited") as Error & { status: number };
      exitError.status = 1;
      vi.mocked(execFileSync).mockImplementation(() => {
        throw exitError;
      });

      const result = await grepTool.execute(
        { pattern: "nope" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("No matches found.");
    });

    it("returns error for non-exit-code-1 failures", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execFileSync).mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = await grepTool.execute(
        { pattern: "test" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("command not found");
    });

    describe("permissions", () => {
      it("searches without confirmation when cwd read permission granted", async () => {
        vi.mocked(isGitRepo).mockReturnValue(false);
        vi.mocked(execFileSync).mockReturnValue("match\n");
        const confirm = vi.fn();

        const result = await grepTool.execute(
          { pattern: "x" },
          mockToolContext({ confirm }),
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation when read permission not granted", async () => {
        vi.mocked(isGitRepo).mockReturnValue(false);
        vi.mocked(execFileSync).mockReturnValue("match\n");
        const confirm = vi.fn(async () => true);

        const result = await grepTool.execute(
          { pattern: "x" },
          mockToolContext({
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

        const result = await grepTool.execute(
          { pattern: "x" },
          mockToolContext({
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
