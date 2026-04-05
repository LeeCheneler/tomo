import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
  appendFile,
  ensureDir,
  fileExists,
  listDir,
  readFile,
  writeFile,
} from "./fs";

vi.mock("node:fs", () => ({
  appendFileSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
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

describe("ensureDir", () => {
  it("delegates to mkdirSync with recursive option", () => {
    ensureDir("/my/dir");
    expect(mkdirSync).toHaveBeenCalledWith("/my/dir", { recursive: true });
  });
});
