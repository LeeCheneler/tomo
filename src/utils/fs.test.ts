import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ensureDir, fileExists, readFile, writeFile } from "./fs";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
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

describe("ensureDir", () => {
  it("delegates to mkdirSync with recursive option", () => {
    ensureDir("/my/dir");
    expect(mkdirSync).toHaveBeenCalledWith("/my/dir", { recursive: true });
  });
});
