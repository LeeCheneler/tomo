import { afterEach, describe, expect, it } from "vitest";
import {
  ensureDir,
  fileExists,
  isDirectory,
  readFile,
  removeDir,
  removeFile,
  writeFile,
} from "../utils/fs";
import { mockFs } from "./mock-fs";

describe("mockFs", () => {
  let state: ReturnType<typeof mockFs>;

  afterEach(() => {
    state?.restore();
  });

  it("returns file content for existing paths", () => {
    state = mockFs({ "/test/file.txt": "hello" });
    expect(readFile("/test/file.txt")).toBe("hello");
  });

  it("reports existing paths via fileExists", () => {
    state = mockFs({ "/test/file.txt": "hello" });
    expect(fileExists("/test/file.txt")).toBe(true);
    expect(fileExists("/test/missing.txt")).toBe(false);
  });

  it("throws ENOENT for missing paths", () => {
    state = mockFs({});
    expect(() => readFile("/missing.txt")).toThrow("ENOENT");
  });

  it("captures writes and exposes them via getFile", () => {
    state = mockFs({});
    writeFile("/test/new.txt", "written");
    expect(state.getFile("/test/new.txt")).toBe("written");
  });

  it("returns all paths via getPaths", () => {
    state = mockFs({ "/a.txt": "a", "/b.txt": "b" });
    expect(state.getPaths()).toEqual(["/a.txt", "/b.txt"]);
  });

  it("makes written files readable", () => {
    state = mockFs({});
    writeFile("/test/new.txt", "content");
    expect(fileExists("/test/new.txt")).toBe(true);
    expect(readFile("/test/new.txt")).toBe("content");
  });

  it("ensureDir tracks the directory so isDirectory reports true", () => {
    state = mockFs({});
    ensureDir("/test/empty");
    expect(isDirectory("/test/empty")).toBe(true);
    expect(state.getDirs()).toContain("/test/empty");
  });

  it("accepts initial empty directories via the second argument", () => {
    state = mockFs({}, ["/test/empty"]);
    expect(isDirectory("/test/empty")).toBe(true);
    expect(state.getDirs()).toContain("/test/empty");
  });

  it("removeFile deletes a file from the virtual fs", () => {
    state = mockFs({ "/test/file.txt": "bye" });
    removeFile("/test/file.txt");
    expect(state.getFile("/test/file.txt")).toBeUndefined();
    expect(fileExists("/test/file.txt")).toBe(false);
  });

  it("removeFile throws ENOENT for missing paths", () => {
    state = mockFs({});
    expect(() => removeFile("/missing.txt")).toThrow("ENOENT");
  });

  describe("removeDir", () => {
    it("removes an empty directory non-recursively", () => {
      state = mockFs({}, ["/test/empty"]);
      removeDir("/test/empty", false);
      expect(state.getDirs()).not.toContain("/test/empty");
    });

    it("throws ENOTEMPTY for non-empty directory when not recursive", () => {
      state = mockFs({ "/test/dir/a.txt": "hi" });
      expect(() => removeDir("/test/dir", false)).toThrow("ENOTEMPTY");
    });

    it("throws ENOENT for missing path", () => {
      state = mockFs({});
      expect(() => removeDir("/missing", false)).toThrow("ENOENT");
    });

    it("recursively removes files and sub-directories, leaving siblings intact", () => {
      state = mockFs(
        {
          "/test/tree/a.txt": "a",
          "/test/tree/sub/b.txt": "b",
          "/test/other/c.txt": "c",
        },
        ["/test/tree/empty-sub", "/test/other/empty"],
      );
      removeDir("/test/tree", true);
      expect(state.getFile("/test/tree/a.txt")).toBeUndefined();
      expect(state.getFile("/test/tree/sub/b.txt")).toBeUndefined();
      expect(state.getDirs()).not.toContain("/test/tree/empty-sub");
      // Siblings outside the removed tree are untouched
      expect(state.getFile("/test/other/c.txt")).toBe("c");
      expect(state.getDirs()).toContain("/test/other/empty");
    });

    it("throws ENOENT for missing path in recursive mode", () => {
      state = mockFs({});
      expect(() => removeDir("/missing", true)).toThrow("ENOENT");
    });
  });
});
