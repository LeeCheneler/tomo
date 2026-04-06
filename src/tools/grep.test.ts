import { execSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isGitRepo } from "../prompt/git-context";
import type { ToolContext } from "./types";
import { grepTool } from "./grep";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  statSync: vi.fn(() => null),
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
      vi.mocked(execSync).mockReturnValue("src/foo.ts:10:// TODO fix\n");

      const result = await grepTool.execute({ pattern: "TODO" }, stubContext());

      expect(result.status).toBe("ok");
      expect(result.output).toBe("src/foo.ts:10:// TODO fix");
      expect(execSync).toHaveBeenCalledOnce();
      expect(String(vi.mocked(execSync).mock.calls[0]?.[0])).toContain(
        "git grep",
      );
    });

    it("uses regular grep outside a git repo", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execSync).mockReturnValue("./foo.ts:5:match\n");

      const result = await grepTool.execute(
        { pattern: "match" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("./foo.ts:5:match");
      expect(String(vi.mocked(execSync).mock.calls[0]?.[0])).toContain(
        "grep -rn",
      );
    });

    it("uses regular grep when gitignore is false", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue("./foo.ts:1:hit\n");

      const result = await grepTool.execute(
        { pattern: "hit", gitignore: false },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(String(vi.mocked(execSync).mock.calls[0]?.[0])).toContain(
        "grep -rn",
      );
    });

    it("passes include filter to git grep", async () => {
      vi.mocked(isGitRepo).mockReturnValue(true);
      vi.mocked(execSync).mockReturnValue("a.ts:1:x\n");

      await grepTool.execute({ pattern: "x", include: "*.ts" }, stubContext());

      const cmd = String(vi.mocked(execSync).mock.calls[0]?.[0]);
      expect(cmd).toContain("git grep");
      expect(cmd).toContain("**/*.ts");
    });

    it("passes include filter to regular grep", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execSync).mockReturnValue("a.ts:1:x\n");

      await grepTool.execute({ pattern: "x", include: "*.ts" }, stubContext());

      const cmd = String(vi.mocked(execSync).mock.calls[0]?.[0]);
      expect(cmd).toContain("grep -rn");
      expect(cmd).toContain("--include");
      expect(cmd).toContain("*.ts");
    });

    it("searches a single file when path points to a file", async () => {
      const filePath = resolve("src/foo.ts");
      vi.mocked(statSync).mockReturnValue({ isFile: () => true } as never);
      vi.mocked(execSync).mockReturnValue("5:match\n");

      const result = await grepTool.execute(
        { pattern: "match", path: "src/foo.ts" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      const cmd = String(vi.mocked(execSync).mock.calls[0]?.[0]);
      expect(cmd).toContain("grep -n -E");
      expect(cmd).toContain(filePath);
    });

    it("returns no matches message when output is empty", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execSync).mockReturnValue("");

      const result = await grepTool.execute(
        { pattern: "nothing" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("No matches found.");
    });

    it("returns no matches when grep exits with code 1", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      const exitError = new Error("grep exited") as Error & { status: number };
      exitError.status = 1;
      vi.mocked(execSync).mockImplementation(() => {
        throw exitError;
      });

      const result = await grepTool.execute({ pattern: "nope" }, stubContext());

      expect(result.status).toBe("ok");
      expect(result.output).toBe("No matches found.");
    });

    it("returns error for non-exit-code-1 failures", async () => {
      vi.mocked(isGitRepo).mockReturnValue(false);
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error("command not found");
      });

      const result = await grepTool.execute({ pattern: "test" }, stubContext());

      expect(result.status).toBe("error");
      expect(result.output).toContain("command not found");
    });

    describe("permissions", () => {
      it("searches without confirmation when cwd read permission granted", async () => {
        vi.mocked(isGitRepo).mockReturnValue(false);
        vi.mocked(execSync).mockReturnValue("match\n");
        const confirm = vi.fn();

        const result = await grepTool.execute(
          { pattern: "x" },
          stubContext({ confirm }),
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation when read permission not granted", async () => {
        vi.mocked(isGitRepo).mockReturnValue(false);
        vi.mocked(execSync).mockReturnValue("match\n");
        const confirm = vi.fn(async () => true);

        const result = await grepTool.execute(
          { pattern: "x" },
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

        const result = await grepTool.execute(
          { pattern: "x" },
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
