import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFs } from "../test-utils/mock-fs";
import { loadInstructions } from "./instructions";

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "/mock-home",
}));

const GLOBAL_PATH = resolve("/mock-home", "tomo.md");
const LOCAL_CWD = "/mock-project";
const LOCAL_PATH = resolve(LOCAL_CWD, ".tomo", "tomo.md");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("loadInstructions", () => {
  it("returns null when no instruction files exist", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({});

    const result = loadInstructions();

    expect(result).toBeNull();
    fs.restore();
  });

  it("loads global ~/tomo.md", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({ [GLOBAL_PATH]: "global instructions" });

    const result = loadInstructions();

    expect(result).toBe("global instructions");
    fs.restore();
  });

  it("loads local .tomo/tomo.md", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({ [LOCAL_PATH]: "local instructions" });

    const result = loadInstructions();

    expect(result).toBe("local instructions");
    fs.restore();
  });

  it("combines global and local with separator", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({
      [GLOBAL_PATH]: "global",
      [LOCAL_PATH]: "local",
    });

    const result = loadInstructions();

    expect(result).toBe("global\n\n---\n\nlocal");
    fs.restore();
  });

  it("ignores empty global file", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({
      [GLOBAL_PATH]: "   ",
      [LOCAL_PATH]: "local only",
    });

    const result = loadInstructions();

    expect(result).toBe("local only");
    fs.restore();
  });

  it("ignores empty local file", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({
      [GLOBAL_PATH]: "global only",
      [LOCAL_PATH]: "  \n  ",
    });

    const result = loadInstructions();

    expect(result).toBe("global only");
    fs.restore();
  });

  it("returns null when both files are empty", () => {
    vi.spyOn(process, "cwd").mockReturnValue(LOCAL_CWD);
    const fs = mockFs({
      [GLOBAL_PATH]: "   ",
      [LOCAL_PATH]: "",
    });

    const result = loadInstructions();

    expect(result).toBeNull();
    fs.restore();
  });
});
