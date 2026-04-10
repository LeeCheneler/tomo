import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFs } from "../test-utils/mock-fs";
import { mockToolContext } from "../test-utils/stub-context";
import { removeFileTool } from "./remove-file";

describe("removeFileTool", () => {
  it("has correct name and parameters", () => {
    expect(removeFileTool.name).toBe("remove_file");
    expect(removeFileTool.parameters).toHaveProperty("properties");
    expect(removeFileTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the path argument", () => {
      expect(removeFileTool.formatCall({ path: "./bar.ts" })).toBe("./bar.ts");
    });

    it("returns empty string when path is missing", () => {
      expect(removeFileTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    it("removes a file in cwd and returns ok", async () => {
      const filePath = resolve("doomed.txt");
      fs = mockFs({ [filePath]: "bye" });

      const result = await removeFileTool.execute(
        { path: "doomed.txt" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("Removed");
      expect(result.output).toContain(filePath);
      expect(fs.getFile(filePath)).toBeUndefined();
    });

    it("removes a file outside cwd when globalRemoveFile is true", async () => {
      const filePath = "/tmp/outside.txt";
      fs = mockFs({ [filePath]: "bye" });
      const ctx = mockToolContext({
        permissions: {
          cwdReadFile: true,
          cwdWriteFile: true,
          cwdRemoveFile: true,
          globalReadFile: false,
          globalWriteFile: false,
          globalRemoveFile: true,
        },
      });

      const result = await removeFileTool.execute({ path: filePath }, ctx);

      expect(result.status).toBe("ok");
      expect(fs.getFile(filePath)).toBeUndefined();
    });

    it("returns error for missing path", async () => {
      fs = mockFs();

      const result = await removeFileTool.execute(
        { path: "nope.txt" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("does not exist");
    });

    it("returns error for directory path", async () => {
      const dirPath = resolve("src");
      fs = mockFs({ [`${dirPath}/foo.ts`]: "content" });

      const result = await removeFileTool.execute(
        { path: "src" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("is a directory");
      expect(result.output).toContain("remove_dir");
    });

    describe("permissions", () => {
      it("removes without confirmation when cwdRemoveFile is granted", async () => {
        const filePath = resolve("allowed.txt");
        fs = mockFs({ [filePath]: "bye" });
        const confirm = vi.fn();
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            cwdRemoveFile: true,
            globalReadFile: false,
            globalWriteFile: false,
            globalRemoveFile: false,
          },
          confirm,
        });

        const result = await removeFileTool.execute(
          { path: "allowed.txt" },
          ctx,
        );

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
        expect(fs.getFile(filePath)).toBeUndefined();
      });

      it("prompts for confirmation when cwdRemoveFile is not granted", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "bye" });
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            cwdRemoveFile: false,
            globalReadFile: false,
            globalWriteFile: false,
            globalRemoveFile: false,
          },
          confirm,
        });

        const result = await removeFileTool.execute(
          { path: "restricted.txt" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith("Remove file?", {
          label: "Remove file?",
          detail: expect.stringContaining("restricted.txt"),
        });
        expect(result.status).toBe("ok");
        expect(fs.getFile(filePath)).toBeUndefined();
      });

      it("returns denied and does not remove when user rejects confirmation", async () => {
        const filePath = resolve("restricted.txt");
        fs = mockFs({ [filePath]: "bye" });
        const confirm = vi.fn(async () => false);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            cwdRemoveFile: false,
            globalReadFile: false,
            globalWriteFile: false,
            globalRemoveFile: false,
          },
          confirm,
        });

        const result = await removeFileTool.execute(
          { path: "restricted.txt" },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("denied");
        expect(fs.getFile(filePath)).toBe("bye");
      });

      it("prompts for global file even when cwdRemoveFile is allowed", async () => {
        const filePath = "/tmp/outside.txt";
        fs = mockFs({ [filePath]: "bye" });
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            cwdRemoveFile: true,
            globalReadFile: false,
            globalWriteFile: false,
            globalRemoveFile: false,
          },
          confirm,
        });

        const result = await removeFileTool.execute({ path: filePath }, ctx);

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
        expect(fs.getFile(filePath)).toBeUndefined();
      });

      it("returns denied and leaves global file intact when user rejects", async () => {
        const filePath = "/tmp/outside.txt";
        fs = mockFs({ [filePath]: "bye" });
        const confirm = vi.fn(async () => false);
        const ctx = mockToolContext({
          permissions: {
            cwdReadFile: true,
            cwdWriteFile: false,
            cwdRemoveFile: true,
            globalReadFile: false,
            globalWriteFile: false,
            globalRemoveFile: false,
          },
          confirm,
        });

        const result = await removeFileTool.execute({ path: filePath }, ctx);

        expect(result.status).toBe("denied");
        expect(fs.getFile(filePath)).toBe("bye");
      });
    });
  });
});
