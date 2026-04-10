import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFs } from "../test-utils/mock-fs";
import { mockToolContext } from "../test-utils/stub-context";
import * as fsUtils from "../utils/fs";
import { removeDirTool } from "./remove-dir";

/** Permissions object with everything off by default. */
const denyAll = {
  cwdReadFile: true,
  cwdWriteFile: false,
  cwdRemoveFile: false,
  cwdRemoveDir: false,
  globalReadFile: false,
  globalWriteFile: false,
  globalRemoveFile: false,
  globalRemoveDir: false,
};

describe("removeDirTool", () => {
  it("has correct name and parameters", () => {
    expect(removeDirTool.name).toBe("remove_dir");
    expect(removeDirTool.parameters).toHaveProperty("properties");
    expect(removeDirTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the path argument when not recursive", () => {
      expect(removeDirTool.formatCall({ path: "./dir" })).toBe("./dir");
    });

    it("appends (recursive) when recursive is true", () => {
      expect(removeDirTool.formatCall({ path: "./dir", recursive: true })).toBe(
        "./dir (recursive)",
      );
    });

    it("returns empty string when path is missing", () => {
      expect(removeDirTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    describe("non-recursive", () => {
      it("removes an empty directory in cwd", async () => {
        const dirPath = resolve("empty");
        fs = mockFs({}, [dirPath]);

        const result = await removeDirTool.execute(
          { path: "empty" },
          mockToolContext(),
        );

        expect(result.status).toBe("ok");
        expect(result.output).toBe(`Removed ${dirPath}`);
        expect(fs.getDirs()).not.toContain(dirPath);
      });

      it("removes an empty directory outside cwd when globalRemoveDir is true", async () => {
        const dirPath = "/tmp/empty";
        fs = mockFs({}, [dirPath]);
        const ctx = mockToolContext({
          permissions: { ...denyAll, globalRemoveDir: true },
        });

        const result = await removeDirTool.execute({ path: dirPath }, ctx);

        expect(result.status).toBe("ok");
        expect(fs.getDirs()).not.toContain(dirPath);
      });

      it("errors when the directory is not empty", async () => {
        const dirPath = resolve("populated");
        fs = mockFs({ [`${dirPath}/a.txt`]: "hi" });

        const result = await removeDirTool.execute(
          { path: "populated" },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toContain("not empty");
        expect(result.output).toContain("recursive: true");
        expect(fs.getFile(`${dirPath}/a.txt`)).toBe("hi");
      });

      it("errors when the path does not exist", async () => {
        fs = mockFs();

        const result = await removeDirTool.execute(
          { path: "missing" },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toContain("does not exist");
      });

      it("errors when the path is a file", async () => {
        const filePath = resolve("file.txt");
        fs = mockFs({ [filePath]: "hi" });

        const result = await removeDirTool.execute(
          { path: "file.txt" },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toContain("is a file");
        expect(result.output).toContain("remove_file");
      });

      it("surfaces non-ENOTEMPTY OS errors from removeDir", async () => {
        const dirPath = resolve("denied");
        fs = mockFs({}, [dirPath]);
        // Simulate e.g. an EPERM from the OS after validation passed.
        vi.spyOn(fsUtils, "removeDir").mockImplementationOnce(() => {
          throw new Error("EACCES: permission denied");
        });

        const result = await removeDirTool.execute(
          { path: "denied" },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toContain("EACCES");
      });

      it("surfaces a generic message when removeDir throws a non-Error", async () => {
        const dirPath = resolve("weird");
        fs = mockFs({}, [dirPath]);
        vi.spyOn(fsUtils, "removeDir").mockImplementationOnce(() => {
          throw "something odd";
        });

        const result = await removeDirTool.execute(
          { path: "weird" },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toBe("unknown error");
      });
    });

    describe("recursive", () => {
      it("removes a populated tree after confirmation", async () => {
        const dirPath = resolve("tree");
        fs = mockFs(
          {
            [`${dirPath}/a.txt`]: "a",
            [`${dirPath}/sub/b.txt`]: "b",
          },
          [`${dirPath}/empty-sub`],
        );
        const ctx = mockToolContext({ confirm: vi.fn(async () => true) });

        const result = await removeDirTool.execute(
          { path: "tree", recursive: true },
          ctx,
        );

        expect(result.status).toBe("ok");
        expect(result.output).toBe(`Removed ${dirPath} recursively`);
        expect(fs.getFile(`${dirPath}/a.txt`)).toBeUndefined();
        expect(fs.getFile(`${dirPath}/sub/b.txt`)).toBeUndefined();
        expect(fs.getDirs()).not.toContain(`${dirPath}/empty-sub`);
      });

      it("errors when the path does not exist", async () => {
        fs = mockFs();

        const result = await removeDirTool.execute(
          { path: "missing", recursive: true },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toContain("does not exist");
      });

      it("errors when the path is a file", async () => {
        const filePath = resolve("file.txt");
        fs = mockFs({ [filePath]: "hi" });

        const result = await removeDirTool.execute(
          { path: "file.txt", recursive: true },
          mockToolContext(),
        );

        expect(result.status).toBe("error");
        expect(result.output).toContain("is a file");
        expect(result.output).toContain("remove_file");
      });
    });

    describe("permissions (non-recursive)", () => {
      it("skips confirmation when cwdRemoveDir is granted", async () => {
        const dirPath = resolve("allowed");
        fs = mockFs({}, [dirPath]);
        const confirm = vi.fn();
        const ctx = mockToolContext({
          permissions: { ...denyAll, cwdRemoveDir: true },
          confirm,
        });

        const result = await removeDirTool.execute({ path: "allowed" }, ctx);

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });

      it("prompts for confirmation when cwdRemoveDir is not granted", async () => {
        const dirPath = resolve("restricted");
        fs = mockFs({}, [dirPath]);
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({ permissions: denyAll, confirm });

        const result = await removeDirTool.execute({ path: "restricted" }, ctx);

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith("Remove directory?", {
          label: "Remove directory?",
          detail: dirPath,
        });
        expect(result.status).toBe("ok");
      });

      it("returns denied and leaves directory when user rejects confirmation", async () => {
        const dirPath = resolve("restricted");
        fs = mockFs({}, [dirPath]);
        const confirm = vi.fn(async () => false);
        const ctx = mockToolContext({ permissions: denyAll, confirm });

        const result = await removeDirTool.execute({ path: "restricted" }, ctx);

        expect(result.status).toBe("denied");
        expect(fs.getDirs()).toContain(dirPath);
      });

      it("prompts for global directory even when cwdRemoveDir is granted", async () => {
        const dirPath = "/tmp/outside";
        fs = mockFs({}, [dirPath]);
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: { ...denyAll, cwdRemoveDir: true },
          confirm,
        });

        const result = await removeDirTool.execute({ path: dirPath }, ctx);

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
      });

      it("skips confirmation when globalRemoveDir is granted", async () => {
        const dirPath = "/tmp/outside";
        fs = mockFs({}, [dirPath]);
        const confirm = vi.fn();
        const ctx = mockToolContext({
          permissions: { ...denyAll, globalRemoveDir: true },
          confirm,
        });

        const result = await removeDirTool.execute({ path: dirPath }, ctx);

        expect(result.status).toBe("ok");
        expect(confirm).not.toHaveBeenCalled();
      });
    });

    describe("permissions (recursive — always prompts)", () => {
      it("still prompts when cwdRemoveDir is granted", async () => {
        const dirPath = resolve("tree");
        fs = mockFs({ [`${dirPath}/a.txt`]: "a" });
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: { ...denyAll, cwdRemoveDir: true },
          confirm,
        });

        const result = await removeDirTool.execute(
          { path: "tree", recursive: true },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(confirm).toHaveBeenCalledWith("Remove directory?", {
          label: "Remove directory?",
          detail: `${dirPath} (recursive)`,
        });
        expect(result.status).toBe("ok");
      });

      it("still prompts when globalRemoveDir is granted", async () => {
        const dirPath = "/tmp/tree";
        fs = mockFs({ [`${dirPath}/a.txt`]: "a" });
        const confirm = vi.fn(async () => true);
        const ctx = mockToolContext({
          permissions: { ...denyAll, globalRemoveDir: true },
          confirm,
        });

        const result = await removeDirTool.execute(
          { path: dirPath, recursive: true },
          ctx,
        );

        expect(confirm).toHaveBeenCalledOnce();
        expect(result.status).toBe("ok");
      });

      it("returns denied and leaves tree when user rejects confirmation", async () => {
        const dirPath = resolve("tree");
        fs = mockFs({ [`${dirPath}/a.txt`]: "a" });
        const confirm = vi.fn(async () => false);
        const ctx = mockToolContext({
          permissions: { ...denyAll, cwdRemoveDir: true },
          confirm,
        });

        const result = await removeDirTool.execute(
          { path: "tree", recursive: true },
          ctx,
        );

        expect(result.status).toBe("denied");
        expect(fs.getFile(`${dirPath}/a.txt`)).toBe("a");
      });
    });
  });
});
