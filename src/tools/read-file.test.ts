import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Permissions } from "../config/schema";
import { mockFs } from "../test-utils/mock-fs";
import type { ToolContext } from "./types";
import { readFileTool } from "./read-file";

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

describe("readFileTool", () => {
  it("has correct name and parameters", () => {
    expect(readFileTool.name).toBe("read_file");
    expect(readFileTool.parameters).toHaveProperty("properties");
    expect(readFileTool.parameters).toHaveProperty("required");
  });

  describe("execute", () => {
    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    it("reads a file with numbered lines", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "line one\nline two\nline three\n" });

      const result = await readFileTool.execute(
        { path: "test.txt" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("   1 | line one");
      expect(result.output).toContain("   2 | line two");
      expect(result.output).toContain("   3 | line three");
    });

    it("reads a specific line range", async () => {
      const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
      const filePath = resolve("big.txt");
      fs = mockFs({ [filePath]: lines.join("\n") });

      const result = await readFileTool.execute(
        { path: "big.txt", startLine: 3, endLine: 5 },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("   3 | line 3");
      expect(result.output).toContain("   5 | line 5");
      expect(result.output).not.toContain("| line 2");
      expect(result.output).not.toContain("| line 6");
    });

    it("reads from startLine to end when endLine is omitted", async () => {
      const lines = Array.from({ length: 5 }, (_, i) => `line ${i + 1}`);
      const filePath = resolve("range.txt");
      fs = mockFs({ [filePath]: lines.join("\n") });

      const result = await readFileTool.execute(
        { path: "range.txt", startLine: 3 },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("   3 | line 3");
      expect(result.output).toContain("   5 | line 5");
    });

    it("reads from start to endLine when startLine is omitted", async () => {
      const lines = Array.from({ length: 5 }, (_, i) => `line ${i + 1}`);
      const filePath = resolve("range.txt");
      fs = mockFs({ [filePath]: lines.join("\n") });

      const result = await readFileTool.execute(
        { path: "range.txt", endLine: 2 },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("   1 | line 1");
      expect(result.output).toContain("   2 | line 2");
      expect(result.output).not.toContain("| line 3");
    });

    it("clamps line range to file bounds", async () => {
      const filePath = resolve("short.txt");
      fs = mockFs({ [filePath]: "a\nb\nc" });

      const result = await readFileTool.execute(
        { path: "short.txt", startLine: -5, endLine: 999 },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("   1 | a");
      expect(result.output).toContain("   3 | c");
    });

    it("truncates files over 500 lines", async () => {
      const lines = Array.from({ length: 600 }, (_, i) => `line ${i + 1}`);
      const filePath = resolve("huge.txt");
      fs = mockFs({ [filePath]: lines.join("\n") });

      const result = await readFileTool.execute(
        { path: "huge.txt" },
        stubContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("   1 | line 1");
      expect(result.output).toContain(" 500 | line 500");
      expect(result.output).not.toContain("| line 501");
    });

    it("returns error for missing file", async () => {
      fs = mockFs();

      const result = await readFileTool.execute(
        { path: "nope.txt" },
        stubContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("file not found");
    });

    it("returns error for directory path", async () => {
      const dirPath = resolve("src");
      fs = mockFs({ [`${dirPath}/foo.ts`]: "content" });

      const result = await readFileTool.execute({ path: "src" }, stubContext());

      expect(result.status).toBe("error");
      expect(result.output).toContain("is a directory");
    });

    describe("permissions", () => {
      it("reads without confirmation when cwd permission granted", async () => {
        const filePath = resolve("allowed.txt");
        fs = mockFs({ [filePath]: "content" });
        const confirm = vi.fn();
        const ctx = stubContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await readFileTool.execute({ path: "allowed.txt" }, ctx);

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation when permission not granted", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "secret" });
        const confirm = vi.fn(async () => true);
        const ctx = stubContext({
          permissions: {
            cwdReadFile: false,
            cwdWriteFile: false,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await readFileTool.execute(
          { path: "restricted.txt" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
      });

      it("returns denied when user rejects confirmation", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "secret" });
        const confirm = vi.fn(async () => false);
        const ctx = stubContext({
          permissions: {
            cwdReadFile: false,
            cwdWriteFile: false,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await readFileTool.execute(
          { path: "restricted.txt" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("denied");
      });

      it("prompts for global file even when cwd read is allowed", async () => {
        fs = mockFs({ "/etc/hosts": "127.0.0.1 localhost" });
        const confirm = vi.fn(async () => true);
        const ctx = stubContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await readFileTool.execute({ path: "/etc/hosts" }, ctx);

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
      });

      it("reads global file without confirmation when globalReadFile is true", async () => {
        fs = mockFs({ "/etc/hosts": "127.0.0.1 localhost" });
        const confirm = vi.fn();
        const ctx = stubContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            globalReadFile: true,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await readFileTool.execute({ path: "/etc/hosts" }, ctx);

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });
    });
  });
});
