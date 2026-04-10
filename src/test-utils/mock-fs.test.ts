import { afterEach, describe, expect, it } from "vitest";
import {
  ensureDir,
  fileExists,
  readFile,
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

  it("ensureDir is a no-op", () => {
    state = mockFs({});
    expect(() => ensureDir("/test/dir")).not.toThrow();
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
});
