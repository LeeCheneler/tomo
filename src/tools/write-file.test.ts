import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFs } from "../test-utils/mock-fs";
import { mockToolContext } from "../test-utils/stub-context";
import { writeFileTool } from "./write-file";

describe("writeFileTool", () => {
  it("has correct name and parameters", () => {
    expect(writeFileTool.name).toBe("write_file");
    expect(writeFileTool.parameters).toHaveProperty("properties");
    expect(writeFileTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the path argument", () => {
      expect(writeFileTool.formatCall({ path: "./bar.ts" })).toBe("./bar.ts");
    });

    it("returns empty string when path is missing", () => {
      expect(writeFileTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    it("creates a new file and returns diff with + lines", async () => {
      const filePath = resolve("new.txt");
      fs = mockFs();

      const result = await writeFileTool.execute(
        { path: "new.txt", content: "hello\nworld" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.format).toBe("diff");
      expect(result.output).toContain("+hello");
      expect(result.output).toContain("+world");
      expect(fs.getFile(filePath)).toBe("hello\nworld");
    });

    it("overwrites an existing file and returns a unified diff", async () => {
      const filePath = resolve("existing.txt");
      fs = mockFs({ [filePath]: "old content\n" });

      const result = await writeFileTool.execute(
        { path: "existing.txt", content: "new content\n" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.format).toBe("diff");
      expect(result.output).toContain("-old content");
      expect(result.output).toContain("+new content");
      expect(fs.getFile(filePath)).toBe("new content\n");
    });

    it("returns error for directory path", async () => {
      const dirPath = resolve("src");
      fs = mockFs({ [`${dirPath}/foo.ts`]: "content" });

      const result = await writeFileTool.execute(
        { path: "src", content: "nope" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("is a directory");
    });

    describe("permissions", () => {
      it("writes without confirmation when cwd write permission granted", async () => {
        fs = mockFs();
        const confirm = vi.fn();
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: true,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await writeFileTool.execute(
          { path: "allowed.txt", content: "data" },
          ctx,
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation with diff when write permission not granted", async () => {
        fs = mockFs();
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await writeFileTool.execute(
          { path: "restricted.txt", content: "data" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith(
          expect.stringContaining("restricted.txt"),
          expect.objectContaining({ diff: expect.any(String) }),
        );
        expect(result.status).toBe("ok");
      });

      it("returns denied and does not write when user rejects confirmation", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs();
        const confirm = vi.fn(async () => false);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await writeFileTool.execute(
          { path: "restricted.txt", content: "data" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("denied");
        expect(fs.getFile(filePath)).toBeUndefined();
      });

      it("prompts for global file even when cwd write is allowed", async () => {
        fs = mockFs();
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: true,
            globalReadFile: false,
            globalWriteFile: false,
          },
          confirm,
        });

        const result = await writeFileTool.execute(
          { path: "/tmp/outside.txt", content: "data" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
      });

      it("writes global file without confirmation when globalWriteFile is true", async () => {
        fs = mockFs();
        const confirm = vi.fn();
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: true,
            globalReadFile: false,
            globalWriteFile: true,
          },
          confirm,
        });

        const result = await writeFileTool.execute(
          { path: "/tmp/outside.txt", content: "data" },
          ctx,
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });
    });
  });
});
