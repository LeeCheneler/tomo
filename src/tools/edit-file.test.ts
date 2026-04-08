import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFs } from "../test-utils/mock-fs";
import { mockToolContext } from "../test-utils/stub-context";
import { editFileTool } from "./edit-file";

describe("editFileTool", () => {
  it("has correct name and parameters", () => {
    expect(editFileTool.name).toBe("edit_file");
    expect(editFileTool.parameters).toHaveProperty("properties");
    expect(editFileTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the path argument", () => {
      expect(editFileTool.formatCall({ path: "./baz.ts" })).toBe("./baz.ts");
    });

    it("returns empty string when path is missing", () => {
      expect(editFileTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    it("replaces a unique string and returns a diff", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "hello world\n" });

      const result = await editFileTool.execute(
        { path: "test.txt", oldString: "world", newString: "earth" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.format).toBe("diff");
      expect(result.output).toContain("-hello world");
      expect(result.output).toContain("+hello earth");
      expect(fs.getFile(filePath)).toBe("hello earth\n");
    });

    it("replaces a multi-line string", async () => {
      const filePath = resolve("multi.txt");
      fs = mockFs({ [filePath]: "line one\nline two\nline three\n" });

      const result = await editFileTool.execute(
        {
          path: "multi.txt",
          oldString: "line two\nline three",
          newString: "replaced",
        },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBe("line one\nreplaced\n");
    });

    it("returns error when oldString is not found", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "hello world\n" });

      const result = await editFileTool.execute(
        { path: "test.txt", oldString: "missing", newString: "new" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("not found in file");
    });

    it("returns error when oldString appears multiple times", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "foo bar foo\n" });

      const result = await editFileTool.execute(
        { path: "test.txt", oldString: "foo", newString: "baz" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("2 times");
    });

    it("returns error when oldString and newString are identical", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "hello\n" });

      const result = await editFileTool.execute(
        { path: "test.txt", oldString: "hello", newString: "hello" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("identical");
    });

    it("returns error for missing file", async () => {
      fs = mockFs();

      const result = await editFileTool.execute(
        { path: "nope.txt", oldString: "a", newString: "b" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("file not found");
    });

    it("returns error for directory path", async () => {
      const dirPath = resolve("src");
      fs = mockFs({ [`${dirPath}/foo.ts`]: "content" });

      const result = await editFileTool.execute(
        { path: "src", oldString: "a", newString: "b" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("is a directory");
    });

    describe("permissions", () => {
      it("edits without confirmation when cwd write permission granted", async () => {
        const filePath = resolve("allowed.txt");
        fs = mockFs({ [filePath]: "old content\n" });
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

        const result = await editFileTool.execute(
          { path: "allowed.txt", oldString: "old", newString: "new" },
          ctx,
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation with diff when write permission not granted", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "old content\n" });
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

        const result = await editFileTool.execute(
          { path: "restricted.txt", oldString: "old", newString: "new" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith("Edit file?", {
          label: "Edit file?",
          detail: expect.stringContaining("restricted.txt"),
          diff: expect.any(String),
        });
        expect(result.status).toBe("ok");
      });

      it("returns denied and does not write when user rejects confirmation", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "old content\n" });
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

        const result = await editFileTool.execute(
          { path: "restricted.txt", oldString: "old", newString: "new" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("denied");
        expect(fs.getFile(filePath)).toBe("old content\n");
      });
    });
  });
});
