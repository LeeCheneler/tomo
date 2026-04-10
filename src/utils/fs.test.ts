import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  appendFile,
  ensureDir,
  fileExists,
  isDirectory,
  listDir,
  readFile,
  removeDir,
  removeFile,
  writeFile,
} from "./fs";

vi.mock("node:fs", () => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
  rmSync: vi.fn(),
  rmdirSync: vi.fn(),
}));

describe("fileExists", () => {
  it("delegates to existsSync with the path", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    expect(fileExists("/my/path")).toBe(true);
    expect(existsSync).toHaveBeenCalledWith("/my/path");
  });
});

describe("readFile", () => {
  it("delegates to readFileSync with utf-8 encoding", () => {
    vi.mocked(readFileSync).mockReturnValue("content");
    expect(readFile("/my/path")).toBe("content");
    expect(readFileSync).toHaveBeenCalledWith("/my/path", "utf-8");
  });
});

describe("writeFile", () => {
  it("delegates to writeFileSync with utf-8 encoding", () => {
    writeFile("/my/path", "data");
    expect(writeFileSync).toHaveBeenCalledWith("/my/path", "data", "utf-8");
  });
});

describe("appendFile", () => {
  it("delegates to appendFileSync with utf-8 encoding", () => {
    appendFile("/my/path", "data");
    expect(appendFileSync).toHaveBeenCalledWith("/my/path", "data", "utf-8");
  });
});

describe("listDir", () => {
  it("returns filenames when directory exists", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdirSync).mockReturnValue(["a.txt", "b.txt"] as never);
    expect(listDir("/my/dir")).toEqual(["a.txt", "b.txt"]);
    expect(readdirSync).toHaveBeenCalledWith("/my/dir", "utf-8");
  });

  it("returns empty array when directory does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(listDir("/missing")).toEqual([]);
  });
});

describe("isDirectory", () => {
  it("returns true when path is a directory", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => true } as never);
    expect(isDirectory("/my/dir")).toBe(true);
  });

  it("returns false when path is a file", () => {
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(statSync).mockReturnValue({ isDirectory: () => false } as never);
    expect(isDirectory("/my/file")).toBe(false);
  });

  it("returns false when path does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false);
    expect(isDirectory("/missing")).toBe(false);
  });
});

describe("ensureDir", () => {
  it("delegates to mkdirSync with recursive option", () => {
    ensureDir("/my/dir");
    expect(mkdirSync).toHaveBeenCalledWith("/my/dir", { recursive: true });
  });
});

describe("removeFile", () => {
  it("delegates to unlinkSync with the path", () => {
    removeFile("/my/file");
    expect(unlinkSync).toHaveBeenCalledWith("/my/file");
  });
});

describe("removeDir", () => {
  it("delegates to rmdirSync for non-recursive removal", () => {
    removeDir("/my/dir", false);
    expect(rmdirSync).toHaveBeenCalledWith("/my/dir");
  });

  it("delegates to rmSync with recursive option for recursive removal", () => {
    removeDir("/my/dir", true);
    expect(rmSync).toHaveBeenCalledWith("/my/dir", { recursive: true });
  });
});
