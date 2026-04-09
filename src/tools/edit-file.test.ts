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
    it("returns the path argument when there is a single edit", () => {
      expect(
        editFileTool.formatCall({
          path: "./baz.ts",
          edits: [{ oldString: "a", newString: "b" }],
        }),
      ).toBe("./baz.ts");
    });

    it("appends the count when there are multiple edits", () => {
      expect(
        editFileTool.formatCall({
          path: "./baz.ts",
          edits: [
            { oldString: "a", newString: "b" },
            { oldString: "c", newString: "d" },
            { oldString: "e", newString: "f" },
          ],
        }),
      ).toBe("./baz.ts (3 edits)");
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
        {
          path: "test.txt",
          edits: [{ oldString: "world", newString: "earth" }],
        },
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
          edits: [
            {
              oldString: "line two\nline three",
              newString: "replaced",
            },
          ],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBe("line one\nreplaced\n");
    });

    it("applies multiple edits sequentially in order", async () => {
      const filePath = resolve("seq.txt");
      fs = mockFs({ [filePath]: "alpha beta gamma\n" });

      const result = await editFileTool.execute(
        {
          path: "seq.txt",
          edits: [
            { oldString: "alpha", newString: "one" },
            { oldString: "beta", newString: "two" },
            { oldString: "gamma", newString: "three" },
          ],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBe("one two three\n");
    });

    it("applies edits to the result of previous edits, not the original", async () => {
      const filePath = resolve("chain.txt");
      fs = mockFs({ [filePath]: "foo\n" });

      const result = await editFileTool.execute(
        {
          path: "chain.txt",
          edits: [
            { oldString: "foo", newString: "bar" },
            { oldString: "bar", newString: "baz" },
          ],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBe("baz\n");
    });

    it("replaces every occurrence when replaceAll is true", async () => {
      const filePath = resolve("rename.txt");
      fs = mockFs({ [filePath]: "foo foo foo\n" });

      const result = await editFileTool.execute(
        {
          path: "rename.txt",
          edits: [{ oldString: "foo", newString: "bar", replaceAll: true }],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBe("bar bar bar\n");
    });

    it("succeeds with replaceAll true even when only one occurrence exists", async () => {
      const filePath = resolve("single.txt");
      fs = mockFs({ [filePath]: "hello world\n" });

      const result = await editFileTool.execute(
        {
          path: "single.txt",
          edits: [{ oldString: "world", newString: "earth", replaceAll: true }],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBe("hello earth\n");
    });

    it("returns error when oldString is not found", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "hello world\n" });

      const result = await editFileTool.execute(
        {
          path: "test.txt",
          edits: [{ oldString: "missing", newString: "new" }],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("not found in file");
      expect(result.output).toContain("edit 1");
    });

    it("returns error when oldString appears multiple times without replaceAll", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "foo bar foo\n" });

      const result = await editFileTool.execute(
        {
          path: "test.txt",
          edits: [{ oldString: "foo", newString: "baz" }],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("2 times");
      expect(result.output).toContain("replaceAll");
    });

    it("returns error when oldString and newString are identical", async () => {
      const filePath = resolve("test.txt");
      fs = mockFs({ [filePath]: "hello\n" });

      const result = await editFileTool.execute(
        {
          path: "test.txt",
          edits: [{ oldString: "hello", newString: "hello" }],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("identical");
    });

    it("fails atomically and does not modify the file when one edit in the batch fails", async () => {
      const filePath = resolve("atomic.txt");
      fs = mockFs({ [filePath]: "alpha beta\n" });

      const result = await editFileTool.execute(
        {
          path: "atomic.txt",
          edits: [
            { oldString: "alpha", newString: "one" },
            { oldString: "missing", newString: "x" },
            { oldString: "beta", newString: "two" },
          ],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("edit 2");
      expect(result.output).toContain("not found");
      expect(fs.getFile(filePath)).toBe("alpha beta\n");
    });

    it("identifies the failing edit by 1-based index", async () => {
      const filePath = resolve("indexed.txt");
      fs = mockFs({ [filePath]: "a b c\n" });

      const result = await editFileTool.execute(
        {
          path: "indexed.txt",
          edits: [
            { oldString: "a", newString: "x" },
            { oldString: "b", newString: "y" },
            { oldString: "nope", newString: "z" },
          ],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("edit 3");
      expect(fs.getFile(filePath)).toBe("a b c\n");
    });

    it("returns error for missing file", async () => {
      fs = mockFs();

      const result = await editFileTool.execute(
        {
          path: "nope.txt",
          edits: [{ oldString: "a", newString: "b" }],
        },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("file not found");
    });

    it("returns error for directory path", async () => {
      const dirPath = resolve("src");
      fs = mockFs({ [`${dirPath}/foo.ts`]: "content" });

      const result = await editFileTool.execute(
        {
          path: "src",
          edits: [{ oldString: "a", newString: "b" }],
        },
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
          {
            path: "allowed.txt",
            edits: [{ oldString: "old", newString: "new" }],
          },
          ctx,
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts once with a combined diff when write permission not granted", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "alpha beta\n" });
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
          {
            path: "restricted.txt",
            edits: [
              { oldString: "alpha", newString: "one" },
              { oldString: "beta", newString: "two" },
            ],
          },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith("Edit file?", {
          label: "Edit file?",
          detail: expect.stringContaining("restricted.txt"),
          diff: expect.any(String),
        });
        expect(result.status).toBe("ok");
        expect(result.output).toContain("-alpha beta");
        expect(result.output).toContain("+one two");
        expect(fs.getFile(filePath)).toBe("one two\n");
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
          {
            path: "restricted.txt",
            edits: [{ oldString: "old", newString: "new" }],
          },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("denied");
        expect(fs.getFile(filePath)).toBe("old content\n");
      });
    });
  });
});
